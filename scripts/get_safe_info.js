/*
How to run the command
----------------------
The script inherits a Web3 instance from Truffle, according to the configuration
contained within truffle.js.

 ./node_modules/.bin/truffle exec scripts/get_safe_info -- \
 --safe-address 0x7e664541678c4997ad9dbdb9978c6e2b5a9445be

*/

const args = require('yargs').option('safe-address', {
  string: true
}).argv // ask argv to treat args as a string

// Contracts
const GnosisSafe = artifacts.require("./GnosisSafe.sol")

module.exports = async function(callback) {
  let safeAddress

  // Check args
  if (!args['safe-address']) {
    callback('--safe-address argument not provided. Please provide the Safe address')
  } else {
    safeAddress = args['safe-address']
  }

  try {
    // Get Safe instance
    const safeInstance = GnosisSafe.at(safeAddress)
    const owners = await safeInstance.getOwners()
    const modules = await safeInstance.getModules()
    const balance = this.web3.eth.getBalance(safeAddress) // web3 is setted globally by truffle

    console.log("=============== SAFE INFO ================")
    // Print safe info
    console.log(`Safe: ${safeAddress}`)
    console.log(`Current Owners: ${owners}`)
    console.log(`Balance: ${balance.div(1e18)} ETH`)
    console.log(`Modules: ${modules != '' ? modules: 'None'}`)
    console.log("==========================================")
  } catch (error) {
    callback(error)
  }

  // Close script
  callback()
}
