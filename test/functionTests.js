const {expect, assert} = require("chai")
const { ethers } = require("hardhat")
const h = require("./helpers/helpers.js")

describe("Dollar auction - function tests", function () {

    let accounts
    let auction, tellor
    let usdc, trb, wmatic
    let tokens

    // generate query data and ids for tokens
    const abiCoder = new ethers.utils.AbiCoder()
    const USDC_QUERY_DATA_ARGS = abiCoder.encode(["string", "string"], ["usdc", "usd"])
    const USDC_QUERY_DATA = abiCoder.encode(["string", "bytes"], ["SpotPrice", USDC_QUERY_DATA_ARGS])
    const USDC_QUERY_ID = ethers.utils.keccak256(USDC_QUERY_DATA)
    const TRB_QUERY_DATA_ARGS = abiCoder.encode(["string", "string"], ["trb", "usd"])
    const TRB_QUERY_DATA = abiCoder.encode(["string", "bytes"], ["SpotPrice", TRB_QUERY_DATA_ARGS])
    const TRB_QUERY_ID = ethers.utils.keccak256(TRB_QUERY_DATA)
    const MATIC_QUERY_DATA_ARGS = abiCoder.encode(["string", "string"], ["matic", "usd"])
    const MATIC_QUERY_DATA = abiCoder.encode(["string", "bytes"], ["SpotPrice", MATIC_QUERY_DATA_ARGS])
    const MATIC_QUERY_ID = ethers.utils.keccak256(MATIC_QUERY_DATA)

    let queryIds = [
        USDC_QUERY_ID, 
        TRB_QUERY_ID, 
        MATIC_QUERY_ID, 
    ]

    let prizePoolAmounts = [
        BigInt(100E18), // usdc
        BigInt(10E18), // trb
        BigInt(20E18), // matic
    ]

    beforeEach("deploy dollar auction", async function () {
        accounts = await ethers.getSigners()
        const TellorFac = await ethers.getContractFactory("TellorPlayground")
        tellor = await TellorFac.deploy()
        await tellor.deployed()

        const TokenFac = await ethers.getContractFactory("TellorPlayground")
        usdc = await TokenFac.deploy()
        await usdc.deployed()
        trb = await TokenFac.deploy()
        await trb.deployed()
        wmatic = await TokenFac.deploy()
        await wmatic.deployed()

        tokens = [usdc.address, trb.address, wmatic.address]

        const DollarAuctionFac = await ethers.getContractFactory("DollarAuctionTest")
        auction = await DollarAuctionFac.deploy(tellor.address, tokens, queryIds)

        await usdc.faucet(accounts[0].address)
        await trb.faucet(accounts[0].address)
        await wmatic.faucet(accounts[0].address)
        await usdc.approve(auction.address, h.toWei("1000"))
        await trb.approve(auction.address, h.toWei("1000"))
        await wmatic.approve(auction.address, h.toWei("1000"))

        await auction.init(prizePoolAmounts)
    })

    it("constructor", async function () {
        assert(await auction.tellor() == tellor.address, "tellor address not set")

        let tokenAddresses = await auction.getTokenAddresses()
        let usdcInfo = await auction.getTokenInfo(usdc.address)
        assert(usdcInfo.isApproved == true, "usdc not approved")
        assert(usdcInfo.queryId == USDC_QUERY_ID, "usdc query id not set")
        assert(tokenAddresses[0] == usdc.address, "usdc address not set")

        let trbInfo = await auction.getTokenInfo(trb.address)
        assert(trbInfo.isApproved == true, "trb not approved")
        assert(trbInfo.queryId == TRB_QUERY_ID, "trb query id not set")
        assert(tokenAddresses[1] == trb.address, "trb address not set")

        let maticInfo = await auction.getTokenInfo(wmatic.address)
        assert(maticInfo.isApproved == true, "matic not approved")
        assert(maticInfo.queryId == MATIC_QUERY_ID, "matic query id not set")
        assert(tokenAddresses[2] == wmatic.address, "matic address not set")
    })

    it("init", async function () {
        blocky = await h.getBlock()
        await h.expectThrow(auction.init(prizePoolAmounts), "auction should not init twice")

        let usdcBal = await usdc.balanceOf(auction.address)
        assert(usdcBal == prizePoolAmounts[0], "usdc balance not set")

        let trbBal = await trb.balanceOf(auction.address)
        assert(trbBal == prizePoolAmounts[1], "trb balance not set")

        let maticBal = await wmatic.balanceOf(auction.address)
        assert(maticBal == prizePoolAmounts[2], "matic balance not set")

        let endTimestamp = await auction.endTimestamp()
        assert(endTimestamp == blocky.timestamp + 86400 * 7, "end timestamp not set correctly")
    })

    it("bid", async function() {
        await tellor.submitValue(TRB_QUERY_ID, h.uintTob32(h.toWei("10")), 0, TRB_QUERY_DATA)
        await h.advanceTime(3600 * 2)
        
        await trb.transfer(accounts[1].address, h.toWei("100"))
        await trb.connect(accounts[1]).approve(auction.address, h.toWei("100"))
        await auction.connect(accounts[1]).bid(trb.address, h.toWei("1"))
        trbInfo = await auction.getTokenInfo(trb.address)
        assert(trbInfo.totalBids == h.toWei("1"), "total bids not updated")
        assert(await auction.getPointsByAddress(accounts[1].address) == 1, "points not updated")
        assert(await auction.totalPoints() == 1, "total points not updated")
        assert(await auction.topBidder() == accounts[1].address, "top bidder not set")
        assert(await auction.topBidUsd() == h.toWei("10"), "top bid usd not set")
        
        // require token is approved
        await tellor.faucet(accounts[0].address)
        await tellor.approve(auction.address, h.toWei("1000"))
        await h.expectThrow(auction.bid(tellor.address, h.toWei("2")), "should not be able to bid with non-approved token")

        // require bid is higher than top bid + $1
        await h.expectThrow(auction.connect(accounts[1]).bid(trb.address, h.toWei("1.1")), "should not be able to bid lower than top bid + $1")

        // can bid again
        await auction.connect(accounts[1]).bid(trb.address, h.toWei("2"))
        trbInfo = await auction.getTokenInfo(trb.address)
        assert(trbInfo.totalBids == h.toWei("3"), "total bids not updated") 
        assert(await auction.getPointsByAddress(accounts[1].address) == 2, "points not updated")
        assert(await auction.totalPoints() == 2, "total points not updated")
        assert(await auction.topBidder() == accounts[1].address, "top bidder not set")
        assert(await auction.topBidUsd() == h.toWei("20"), "top bid usd not set")

        await h.advanceTime(86400 * 7)
        await h.expectThrow(auction.bid(trb.address, h.toWei("5")), "should not be able to bid after auction ends")
    })

    it("claimPoints", async function() {
        await tellor.submitValue(TRB_QUERY_ID, h.uintTob32(h.toWei("10")), 0, TRB_QUERY_DATA)
        await h.advanceTime(3600 * 2)
        
        await trb.transfer(accounts[1].address, h.toWei("1"))
        await trb.transfer(accounts[2].address, h.toWei("2"))
        await trb.connect(accounts[1]).approve(auction.address, h.toWei("100"))
        await trb.connect(accounts[2]).approve(auction.address, h.toWei("100"))
        await auction.connect(accounts[1]).bid(trb.address, h.toWei("1"))
        await auction.connect(accounts[2]).bid(trb.address, h.toWei("2"))

        await h.advanceTime(86400 * 7)
        await h.expectThrow(auction.connect(accounts[1]).claimPoints(), "should not be able to claim points before auction is settled")
        await auction.settle()
        await h.expectThrow(auction.connect(accounts[2]).claimPoints(), "should not be able to claim points with no points")
        await auction.connect(accounts[1]).claimPoints()
        await h.expectThrow(auction.connect(accounts[1]).claimPoints(), "should not be able to claim points twice")
        assert(await auction.getPointsByAddress(accounts[1].address) == 0, "points not updated correctly")
        assert(await trb.balanceOf(accounts[1].address) == h.toWei("3"), "balance not updated correctly")
    })

    it("claimWinnerPrize", async function() {
        await tellor.submitValue(TRB_QUERY_ID, h.uintTob32(h.toWei("10")), 0, TRB_QUERY_DATA)
        await h.advanceTime(3600 * 2)
        
        await trb.transfer(accounts[1].address, h.toWei("1"))
        await trb.transfer(accounts[2].address, h.toWei("2"))
        await trb.connect(accounts[1]).approve(auction.address, h.toWei("100"))
        await trb.connect(accounts[2]).approve(auction.address, h.toWei("100"))
        await auction.connect(accounts[1]).bid(trb.address, h.toWei("1"))
        await auction.connect(accounts[2]).bid(trb.address, h.toWei("2"))

        await h.advanceTime(86400 * 7)
        await h.expectThrow(auction.connect(accounts[2]).claimWinnerPrize(), "should not be able to claim winner prize before auction is settled")
        await auction.settle()
        await h.expectThrow(auction.connect(accounts[1]).claimWinnerPrize(), "should not be able to claim winner prize if not winner")
        await auction.connect(accounts[2]).claimWinnerPrize()
        assert(await usdc.balanceOf(accounts[2].address) == prizePoolAmounts[0], "prize balance not updated correctly")
        assert(await trb.balanceOf(accounts[2].address) == prizePoolAmounts[1], "prize balance not updated correctly")
        assert(await wmatic.balanceOf(accounts[2].address) == prizePoolAmounts[2], "prize balance not updated correctly")

        await auction.connect(accounts[2]).claimWinnerPrize()
        assert(await usdc.balanceOf(accounts[2].address) == prizePoolAmounts[0], "should not be able to claim winner prize twice")
        assert(await trb.balanceOf(accounts[2].address) == prizePoolAmounts[1], "should not be able to claim winner prize twice")
        assert(await wmatic.balanceOf(accounts[2].address) == prizePoolAmounts[2], "should not be able to claim winner prize twice")
    })

    it("fundPoolWithTimeExtension", async function() {
        blocky = await h.getBlock()
        await tellor.submitValue(USDC_QUERY_ID, h.uintTob32(h.toWei("1")), 0, USDC_QUERY_DATA)
        await tellor.submitValue(TRB_QUERY_ID, h.uintTob32(h.toWei("10")), 0, TRB_QUERY_DATA)
        await tellor.submitValue(MATIC_QUERY_ID, h.uintTob32(h.toWei("2")), 0, MATIC_QUERY_DATA)
        await h.advanceTime(3600 * 2)
        
        await tellor.faucet(accounts[0].address)
        await tellor.approve(auction.address, h.toWei("100"))
        await h.expectThrow(auction.fundPoolWithTimeExtension(tellor.address, h.toWei("100")), "should not be able to fund pool with time extension with unapproved token")
        await h.expectThrow(auction.fundPoolWithTimeExtension(trb.address, h.toWei("2")), "should not be able to fund pool with time extension with no token approval")
        await trb.approve(auction.address, h.toWei("100"))
        await h.expectThrow(auction.fundPoolWithTimeExtension(trb.address, h.toWei("2")), "should not be able to fund pool with time extension with amount less than 10% of prize pool")
        
        await auction.fundPoolWithTimeExtension(trb.address, h.toWei("3"))
        expectedEndTimestamp = blocky.timestamp + 86400 * 10
        assert(await auction.endTimestamp() == expectedEndTimestamp, "end timestamp not updated correctly")
        trbInfo = await auction.getTokenInfo(trb.address)
        assert(trbInfo.prizePoolAmount == BigInt(h.toWei("3")) + prizePoolAmounts[1], "prize pool amount not updated correctly")
    })

    it("settle", async function() {
        await tellor.submitValue(TRB_QUERY_ID, h.uintTob32(h.toWei("10")), 0, TRB_QUERY_DATA)
        await h.advanceTime(3600 * 2)
        
        await trb.transfer(accounts[1].address, h.toWei("1"))
        await trb.transfer(accounts[2].address, h.toWei("2"))
        await trb.connect(accounts[1]).approve(auction.address, h.toWei("100"))
        await trb.connect(accounts[2]).approve(auction.address, h.toWei("100"))
        await auction.connect(accounts[1]).bid(trb.address, h.toWei("1"))
        await auction.connect(accounts[2]).bid(trb.address, h.toWei("2"))

        await h.expectThrow(auction.settle(), "should not be able to settle before auction end")
        await h.advanceTime(86400 * 7)
        await auction.settle()
        assert(await auction.totalPoints() == 1, "total points not updated correctly")
        assert(await auction.getPointsByAddress(accounts[2].address) == 0, "winner points not updated correctly")
        assert(await auction.settled(), "settled not updated correctly")
        await h.expectThrow(auction.settle(), "should not be able to settle twice")
    })  
})