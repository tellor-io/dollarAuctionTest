const {expect} = require("chai")
const { ethers } = require("hardhat")
const helpers = require("./helpers")

describe("Dollar auction tests", function () {

    let deployer, bidder1, bidder2, bidder3
    let dollarAuction 

    let trbHolder, maticHolder, usdcHolder
    let usdc, trb, matic

    let tellorOracle = "0xFd45Ae72E81Adaaf01cC61c8bCe016b7060DD537"
    let tellorToken = "0xE3322702BEdaaEd36CdDAb233360B939775ae5f1"
    let maticToken = "0x0000000000000000000000000000000000001010"
    let usdcToken = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"

    let tokens = [tellorToken, maticToken, usdcToken]
    let queryIds = [
        "0x5c13cd9c97dbb98f2429c101a2a8150e6c7a0ddaff6124ee176a3a411067ded0",
        "0x40aa71e5205fdc7bdb7d65f7ae41daca3820c5d3a8f62357a99eda3aa27244a3",
        "0x8ee44cd434ed5b0e007eee581fbe0855336f3f84484e8d9989a620a4a49aa0f7",
    ]

    let prizePoolAmounts = [
        BigInt(1E18),
        BigInt(1E18),
        BigInt(1E18),
    ]

    beforeEach("deploy dollar auction", async function () {

        [deployer, bidder1, bidder2, bidder3] = await ethers.getSigners()
        
        usdcHolder = await helpers.impersonate("0xF977814e90dA44bFA03b6295A0616a897441aceC")
        trbHolder = await helpers.impersonate("0x0d7effefdb084dfeb1621348c8c70cc4e871eba4")
        maticHolder = await helpers.impersonate("0x9AC5637d295FEA4f51E086C329d791cC157B1C84")

        usdc = await ethers.getContractAt("IERC20", usdcToken)
        trb = await ethers.getContractAt("IERC20", tellorToken)
        matic = await ethers.getContractAt("IERC20", maticToken);

        await usdc.connect(usdcHolder).transfer(deployer.address, BigInt(10E18))
        await trb.connect(trbHolder).transfer(deployer.address, BigInt(10E18))
        await matic.connect(maticHolder).transfer(deployer.address, BigInt(10E18))

        const DollarAuction = await ethers.getContractFactory("DollarAuctionTest")

        dollarAuction = await DollarAuction.connect(deployer).deploy(tellorOracle, tokens, queryIds, prizePoolAmounts)

        await dollarAuction.deployed()
    })

    it("bid", async function () {
        
    })
})