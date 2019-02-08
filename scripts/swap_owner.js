/*
How to run the command
----------------------
The script inherits a Web3 instance from Truffle, according to the configuration
contained within truffle.js.

./node_modules/.bin/truffle exec scripts/swap_owner.js \
  --mnemonic 'myth like bonus scare over problem client lizard pioneer submit female collect' \
  --safe-address '0x87148659ea177240c7b41f4e3e340cd7f9b63ce2' \
  --new-owner '0x22d491bde2303f2f43325b2108d26f1eaba1e32b' \
  --old-owner '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1' \
  --prev-owner '0x0000000000000000000000000000000000000001'

*/

const args = require('yargs')
  .option('safe-address', {
    string: true
  }).option('new-owner', {
    string: true
  }).option('old-owner', {
    string: true
  }).option('prev-owner', {
    string: true
  }).argv // ask argv to treat args as a string

global.web3 = this.web3
const constants = require('./constants')
const gnosisUtils = require('../test/utils')

// Contracts
const GnosisSafe = artifacts.require("./GnosisSafe.sol")

module.exports = async function(callback) {
  let safeAddress, newOwner, oldOwner, prevOwner
  const mnemonic = args.mnemonic || this.web3.currentProvider.mnemonic

  // Check args

  if (!args['safe-address']) {
    callback('--safe-address argument not provided. Please provide the Safe address')
  } else {
    safeAddress = args['safe-address']
  }

  if (!args['new-owner']) {
    callback('--new-owner argument not provided')
  } else {
    newOwner = args['new-owner']
  }

  if (!args['old-owner']) {
    callback('--old-owner argument not provided.')
  } else {
    oldOwner = args['old-owner']
  }

  if (!args['prev-owner']) {
    callback('--prev-owner argument not provided.')
  } else {
    prevOwner = args['prev-owner']
  }

  if (!args.mnemonic) {
    console.log("Using Truffle Mnemonic configuration")
  } else {
    console.log(`Provided mnemonic: ${args.mnemonic}`)
  }

  if(oldOwner.toLowerCase() == newOwner.toLowerCase()) {
    callback('The new owner must not coincide with the older one')
  }

  try {
    // Truffle uses the HTTPPRovider When on LOCALHOST, so we need to pass the mnemonic seed via command
    const lightWallet = await gnosisUtils.createLightwallet(mnemonic)

    // Get Safe instance
    const safeInstance = GnosisSafe.at(safeAddress)

    const isOwner = await safeInstance.isOwner(newOwner)
    if (isOwner == true) {
      callback(`Address ${newOwner} is already an owner of the Safe`)
    }

    const currentOwners = await safeInstance.getOwners()
    const sentinels = await safeInstance.SENTINEL_OWNERS()

    // Print safe info
    console.log("============ SAFE INFO =============")
    console.log(`Safe: ${safeAddress}`)
    console.log(`Current Owners: ${currentOwners}`)
    console.log(`New Owner: ${newOwner}`)
    console.log(`Old Owner: ${oldOwner}`)
    console.log(`Prev. Owner: ${prevOwner}`)
    console.log(`Sentinels: ${sentinels}`)
    console.log("==========================================")

    console.log("============= SAFE EXECUTION =============")
    console.log("Get data safeInstance.swapOwner(...) ...")
    // Solidity: function swapOwner(address prevOwner, address oldOwner, address newOwner)
    const swapOwnerData = await safeInstance.contract.swapOwner.getData(prevOwner, oldOwner, newOwner)
    console.log("Get Safe instance nonce...")
    const nonce = await safeInstance.nonce()
    console.log(`Safe Nonce: ${nonce}`)
    console.log("Calculate transaction hash, safeInstance.getTransactionHash(...) ...")
    const transactionHash = await safeInstance.getTransactionHash(safeInstance.address, 0, swapOwnerData, constants.CALL, 0, 0, 0, 0, 0, nonce)
    console.log(`Transaction hash: ${transactionHash}`)
    console.log("Sign transaction...")
    const signatures = gnosisUtils.signTransaction(lightWallet, currentOwners, transactionHash)
    gnosisUtils.logGasUsage(
        'execTransaction setupOwner',
        await safeInstance.execTransaction(
            safeInstance.address, 0, swapOwnerData, constants.CALL, 0, 0, 0, 0, 0, signatures
        )
    )

    // Check that changes were reflected on the Safe
    const newOwnersCheck = await safeInstance.getOwners()
    const isOwnerCheck = await safeInstance.isOwner(newOwner)
    console.log(`Is owner: ${isOwnerCheck}`)
    console.log(`New owners: ${newOwnersCheck}`)
    console.log("==========================================")
  } catch (error) {
    callback(error)
  }

  // Close script
  callback()
}
