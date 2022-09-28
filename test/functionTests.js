const {expect} = require("chai")
const { ethers } = require("hardhat")
const helpers = require("./helpers")

describe("Dollar auction tests", function () {

    let deployer, bidder1, bidder2, bidder3
    let dollarAuction 

    let trbHolder, wMaticHolder, usdcHolder
    let usdc, trb, wMatic

    let tellorOracle = "0xFd45Ae72E81Adaaf01cC61c8bCe016b7060DD537"
    let tellorToken = "0xE3322702BEdaaEd36CdDAb233360B939775ae5f1"
    let wMaticToken = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"
    let usdcToken = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"

    let tokens = [tellorToken, wMaticToken, usdcToken]
    let queryIds = [
        "0x5c13cd9c97dbb98f2429c101a2a8150e6c7a0ddaff6124ee176a3a411067ded0",
        "0x40aa71e5205fdc7bdb7d65f7ae41daca3820c5d3a8f62357a99eda3aa27244a3",
        "0x8ee44cd434ed5b0e007eee581fbe0855336f3f84484e8d9989a620a4a49aa0f7",
    ]

    let prizePoolAmounts = [
        BigInt(1E18), //tellor
        BigInt(1E18), //matic
        BigInt(1E12), //usdc
    ]

    beforeEach("deploy dollar auction", async function () {

        [deployer, bidder1, bidder2, bidder3] = await ethers.getSigners()

        trbHolder = await helpers.impersonate("0x0d7effefdb084dfeb1621348c8c70cc4e871eba4")
        wMaticHolder = await helpers.impersonate("0x01aefac4a308fbaed977648361fbaecfbcd380c7")
        usdcHolder = await helpers.impersonate("0xf977814e90da44bfa03b6295a0616a897441acec")

        accounts = [deployer, bidder1, bidder2, bidder3, trbHolder, usdcHolder]

        for (i = 0; i < accounts.length; i++) {
            await helpers.fundMATIC(accounts[i].address)
        }

        await helpers.fundMATIC(wMaticHolder.address)

        usdc = await ethers.getContractAt("IERC20", usdcToken)
        trb = await ethers.getContractAt("IERC20", tellorToken)
        wMatic = await ethers.getContractAt("IERC20", wMaticToken)

        console.log("connected to contracts")
        await trb.connect(trbHolder).transfer(deployer.address, BigInt(10E18))
        console.log("transferred trb to deployer")
        await usdc.connect(usdcHolder).transfer(deployer.address, BigInt(10E12)) //usdc uses 6 decimal places
        console.log("transferred usdc to deployer")
        await wMatic.connect(wMaticHolder).transfer(deployer.address, BigInt(10E18))
        console.log("transferred wmatic to deployer")

        const DollarAuction = await ethers.getContractFactory("DollarAuctionTest")

        dollarAuction = await DollarAuction.connect(deployer).deploy(tellorOracle, tokens, queryIds)
        console.log("dollar auction deployed")

        await dollarAuction.deployed()

        await trb.connect(deployer).approve(dollarAuction.address, BigInt(1E18))
        console.log("trb approvec")
        await usdc.connect(deployer).approve(dollarAuction.address, BigInt(1E12))
        console.log("usdc approved")
        await wMatic.connect(deployer).approve(dollarAuction.address, BigInt(1E18))
        console.log("matic approved")

        await dollarAuction.connect(deployer).init(prizePoolAmounts)
    })

    it("bid", async function () {

        
        
    })
})