const utils = require('./utils/general')
const ethUtil = require('ethereumjs-util')
const abi = require('ethereumjs-abi')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const Proxy = artifacts.require("./Proxy.sol")
const MultiSend = artifacts.require("./libraries/MultiSend.sol")
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol")
const StateChannelModule = artifacts.require("./modules/StateChannelModule.sol");
const TransactionWrapper = web3.eth.contract([{"constant":false,"inputs":[{"name":"operation","type":"uint8"},{"name":"to","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"}],"name":"send","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]);
        

contract('MultiSend', function(accounts) {

    let gnosisSafe
    let multiSend
    let createAndAddModules
    let proxyFactory
    let stateChannelModuleMasterCopy
    let lw
    let tw = TransactionWrapper.at(1)

    const DELEGATECALL = 1

    beforeEach(async function () {
        // Create Gnosis Safe and MultiSend library
        lw = await utils.createLightwallet()
        gnosisSafe = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, 0, 0, 0, 0, 0)
        multiSend = await MultiSend.new()
        createAndAddModules = await CreateAndAddModules.new()

        proxyFactory = await ProxyFactory.new()
        stateChannelModuleMasterCopy = await StateChannelModule.new()
    })

    it('should deposit and withdraw 2 ETH and change threshold in 1 transaction', async () => {
        // Threshold is 1 after deployment
        assert.equal(await gnosisSafe.getThreshold(), 1)
        // No modules present after deployment
        assert.deepEqual(await gnosisSafe.getModules(), [])
        // Deposit 2 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(2, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(2, 'ether'))
        // Withdraw 2 ETH and change threshold
        let nonce = await gnosisSafe.nonce()
        
        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)

        let stateChannelSetupData = await stateChannelModuleMasterCopy.contract.setup.getData()
        let stateChannelCreationData = await proxyFactory.contract.createProxy.getData(stateChannelModuleMasterCopy.address, stateChannelSetupData)

        // Create library data
        let modulesCreationData = utils.createAndAddModulesData([stateChannelCreationData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)

        let nestedTransactionData = '0x' +
            tw.send.getData(0, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10) +
            tw.send.getData(0, gnosisSafe.address, 0, changeData).substr(10) +
            tw.send.getData(0, accounts[0], web3.toWei(0.5, 'ether'), '0x').substr(10) +
            tw.send.getData(1, createAndAddModules.address, 0, createAndAddModulesData).substr(10) +
            tw.send.getData(0, accounts[1], web3.toWei(0.5, 'ether'), '0x').substr(10) +
            tw.send.getData(0, accounts[2], web3.toWei(1, 'ether'), '0x').substr(10)
        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        utils.logGasUsage(
            'execTransaction send multiple transactions',
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, sigs
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
        assert.equal(await gnosisSafe.getThreshold(), 2)
        let modules = await gnosisSafe.getModules()
        assert.equal(modules.length, 1)
        assert.equal(await web3.eth.getStorageAt(modules[0], 0), stateChannelModuleMasterCopy.address)
    })

    it.only('Use multisend on deployment', async () => {
        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)

        let stateChannelSetupData = await stateChannelModuleMasterCopy.contract.setup.getData()
        let stateChannelCreationData = await proxyFactory.contract.createProxy.getData(stateChannelModuleMasterCopy.address, stateChannelSetupData)

        // Create library data
        let modulesCreationData = utils.createAndAddModulesData([stateChannelCreationData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)

        // This calculates the address if we use the ProxyFactory with create
        let newSafeAddress = "0x" + ethUtil.generateAddress(proxyFactory.address, await web3.eth.getTransactionCount(proxyFactory.address)).toString("hex")

        assert.equal(await web3.eth.getBalance(newSafeAddress), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: newSafeAddress, value: web3.toWei(2.1, 'ether')})
        assert.equal(await web3.eth.getBalance(newSafeAddress), web3.toWei(2.1, 'ether'))
        let nestedTransactionData = '0x' +
            tw.send.getData(0, newSafeAddress, 0, '0x' + '0'.repeat(64)).substr(10) +
            tw.send.getData(0, newSafeAddress, 0, changeData).substr(10) +
            tw.send.getData(0, accounts[0], web3.toWei(0.5, 'ether'), '0x').substr(10) +
            tw.send.getData(1, createAndAddModules.address, 0, createAndAddModulesData).substr(10) +
            tw.send.getData(0, accounts[1], web3.toWei(0.5, 'ether'), '0x').substr(10) +
            tw.send.getData(0, accounts[2], web3.toWei(1, 'ether'), '0x').substr(10)
        let multiSendData = await multiSend.contract.multiSend.getData(nestedTransactionData)

        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafe.contract.setup.getData([lw.accounts[0], lw.accounts[1]], 1, multiSend.address, multiSendData, 0, web3.toWei(0.1, 'ether'), 0)
        let newSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafe.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )

        assert.equal(newSafe.address, newSafeAddress)
        assert.equal(await web3.eth.getBalance(newSafeAddress), 0)
        assert.equal(await newSafe.getThreshold(), 2)
        let modules = await newSafe.getModules()
        assert.equal(modules.length, 1)
        assert.equal(await web3.eth.getStorageAt(modules[0], 0), stateChannelModuleMasterCopy.address)
        let scModule = StateChannelModule.at(modules[0])
        assert.equal(await scModule.manager(), newSafeAddress)
    })

    it.only('Use multisend on deployment with create2', async () => {
        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)

        let stateChannelSetupData = await stateChannelModuleMasterCopy.contract.setup.getData()
        let stateChannelCreationData = await proxyFactory.contract.createProxy.getData(stateChannelModuleMasterCopy.address, stateChannelSetupData)

        // Create library data
        let modulesCreationData = utils.createAndAddModulesData([stateChannelCreationData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)

        // Create Safe setup data
        let nestedTransactionData = '0x' +
            tw.send.getData(0, accounts[0], web3.toWei(0.5, 'ether'), '0x').substr(10) +
            tw.send.getData(1, createAndAddModules.address, 0, createAndAddModulesData).substr(10) +
            tw.send.getData(0, accounts[1], web3.toWei(0.5, 'ether'), '0x').substr(10) +
            tw.send.getData(0, accounts[2], web3.toWei(1, 'ether'), '0x').substr(10)
        let multiSendData = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let gnosisSafeData = await gnosisSafe.contract.setup.getData([lw.accounts[0], lw.accounts[1]], 1, multiSend.address, multiSendData, 0, web3.toWei(0.1, 'ether'), 0)
        
        // This calculates the address if we use the ProxyFactory with create2
        let creationNonce = 1123581321 // Some random number
        let proxyCreationCode = await proxyFactory.proxyCreationCode()
        assert.equal(proxyCreationCode, Proxy.bytecode)
        let constructorData = abi.rawEncode(
            ['address'], 
            [ gnosisSafe.address ]
        ).toString('hex')
        let encodedNonce = abi.rawEncode(['uint256'], [creationNonce]).toString('hex')
        let newSafeAddress = "0x" + ethUtil.generateAddress2(proxyFactory.address, ethUtil.keccak256("0x" + ethUtil.keccak256(gnosisSafeData).toString("hex") + encodedNonce), proxyCreationCode + constructorData).toString("hex")

        // Fund predicted Safe address for creation
        assert.equal(await web3.eth.getBalance(newSafeAddress), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: newSafeAddress, value: web3.toWei(2.1, 'ether')})
        assert.equal(await web3.eth.getBalance(newSafeAddress), web3.toWei(2.1, 'ether'))

        // Create Gnosis Safe
        let newSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxyWithNonce(gnosisSafe.address, gnosisSafeData, creationNonce),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )

        assert.equal(newSafe.address, newSafeAddress)
        assert.equal(await web3.eth.getBalance(newSafeAddress), 0)
        assert.equal(await newSafe.getThreshold(), 1)
        let modules = await newSafe.getModules()
        assert.equal(modules.length, 1)
        assert.equal(await web3.eth.getStorageAt(modules[0], 0), stateChannelModuleMasterCopy.address)
        let scModule = StateChannelModule.at(modules[0])
        assert.equal(await scModule.manager(), newSafeAddress)
    })

    it('invalid operation should fail', async () => {
    
        let nonce = await gnosisSafe.nonce()
        
        let nestedTransactionData = '0x' +
            tw.send.getData(2, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10)

        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        utils.checkTxEvent(
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, sigs
            ),
            'ExecutionFailed', gnosisSafe.address, true, 'execTransaction send multiple transactions'
        )
    })

    it('single fail should fail all', async () => {
        assert.equal(await gnosisSafe.getThreshold(), 1)
    
        let nonce = await gnosisSafe.nonce()

        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)
        
        let nestedTransactionData = '0x' +
            tw.send.getData(0, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10) +
            tw.send.getData(0, gnosisSafe.address, 0, changeData).substr(10) +
            tw.send.getData(2, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10) + // Failing transaction
            tw.send.getData(0, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10)

        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        utils.checkTxEvent(
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, sigs
            ),
            'ExecutionFailed', gnosisSafe.address, true, 'execTransaction send multiple transactions'
        )
        assert.equal(await gnosisSafe.getThreshold(), 1)
    })
})
