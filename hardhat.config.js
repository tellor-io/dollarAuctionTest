require("@nomiclabs/hardhat-waffle");
require("dotenv").config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.4",

  networks: {
    hardhat: {
      // forking: {
      //   url: process.env.FORK_URL
      // }
    }
  }
};
