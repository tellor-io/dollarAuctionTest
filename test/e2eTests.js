const {expect, assert} = require("chai")
const { ethers } = require("hardhat")
const h = require("./helpers/helpers.js")

describe("Dollar auction - e2e tests", function () {

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

    it("realistic test with multiple betters and tokens and extensions", async function () {
        for (let i=1; i<=5; i++) {
            await usdc.transfer(accounts[i].address, h.toWei("100"))
            await trb.transfer(accounts[i].address, h.toWei("100"))
            await wmatic.transfer(accounts[i].address, h.toWei("100"))
            await usdc.connect(accounts[i]).approve(auction.address, h.toWei("100"))
            await trb.connect(accounts[i]).approve(auction.address, h.toWei("100"))
            await wmatic.connect(accounts[i]).approve(auction.address, h.toWei("100"))
        }

        // set prices
        await tellor.submitValue(TRB_QUERY_ID, h.uintTob32(h.toWei("10")), 0, TRB_QUERY_DATA)
        await tellor.submitValue(MATIC_QUERY_ID, h.uintTob32(h.toWei("2")), 0, MATIC_QUERY_DATA)
        await h.advanceTime(3600 * 2)

        // make some bids
        await auction.connect(accounts[1]).bid(trb.address, h.toWei("1"))
        await auction.connect(accounts[2]).bid(wmatic.address, h.toWei("6"))
        await auction.connect(accounts[3]).bid(usdc.address, h.toWei("13"))
        await auction.connect(accounts[4]).bid(trb.address, h.toWei("2"))
        await auction.connect(accounts[5]).bid(usdc.address, h.toWei("21"))

        // update prices
        await tellor.submitValue(TRB_QUERY_ID, h.uintTob32(h.toWei("1")), 0, TRB_QUERY_DATA)
        await tellor.submitValue(MATIC_QUERY_ID, h.uintTob32(h.toWei("10")), 0, MATIC_QUERY_DATA)
        await h.advanceTime(3600 * 2)

        // extend auction
        await auction.connect(accounts[1]).fundPoolWithTimeExtension(usdc.address, h.toWei("50"))

        // make some more bids
        await auction.connect(accounts[1]).bid(trb.address, h.toWei("22"))
        await auction.connect(accounts[2]).bid(wmatic.address, h.toWei("3"))
        await auction.connect(accounts[3]).bid(usdc.address, h.toWei("31"))
        await auction.connect(accounts[4]).bid(trb.address, h.toWei("32"))
        await auction.connect(accounts[5]).bid(usdc.address, h.toWei("33"))

        // update prices
        await tellor.submitValue(TRB_QUERY_ID, h.uintTob32(h.toWei("2")), 0, TRB_QUERY_DATA)
        await tellor.submitValue(MATIC_QUERY_ID, h.uintTob32(h.toWei("2")), 0, MATIC_QUERY_DATA)
        await h.advanceTime(3600 * 2)

        // extend auction
        await auction.connect(accounts[1]).fundPoolWithTimeExtension(wmatic.address, h.toWei("11"))

        // make some more bids
        await auction.connect(accounts[1]).bid(trb.address, h.toWei("17"))
        await auction.connect(accounts[2]).bid(wmatic.address, h.toWei("18"))
        await auction.connect(accounts[3]).bid(usdc.address, h.toWei("37"))
        await auction.connect(accounts[4]).bid(trb.address, h.toWei("19"))
        await auction.connect(accounts[5]).bid(usdc.address, h.toWei("39"))

        // advance time and end auction
        await h.advanceTime(86400 * 13)

        await auction.settle()

        await auction.connect(accounts[5]).claimWinnerPrize()

        for(i = 1; i <= 5; i++) {
            await auction.connect(accounts[i]).claimPoints()
        }

        auctionBalanceUscd = await usdc.balanceOf(auction.address)
        auctionBalanceTrb = await trb.balanceOf(auction.address)
        auctionBalanceWmatic = await wmatic.balanceOf(auction.address)

        assert(auctionBalanceUscd < 10, "auction usdc balance should be less than 10")
        assert(auctionBalanceTrb < 10, "auction trb balance should be less than 10")
        assert(auctionBalanceWmatic < 10, "auction wmatic balance should be less than 10")
    })

    it("multiple bids, make sure all tokens paid correctly", async function () {
        for (let i=1; i<=5; i++) {
            await usdc.transfer(accounts[i].address, h.toWei("100"))
            await trb.transfer(accounts[i].address, h.toWei("100"))
            await wmatic.transfer(accounts[i].address, h.toWei("100"))
            await usdc.connect(accounts[i]).approve(auction.address, h.toWei("100"))
            await trb.connect(accounts[i]).approve(auction.address, h.toWei("100"))
            await wmatic.connect(accounts[i]).approve(auction.address, h.toWei("100"))
        }

        // set prices
        await tellor.submitValue(TRB_QUERY_ID, h.uintTob32(h.toWei("10")), 0, TRB_QUERY_DATA)
        await tellor.submitValue(MATIC_QUERY_ID, h.uintTob32(h.toWei("5")), 0, MATIC_QUERY_DATA)
        await h.advanceTime(3600 * 2)

        // make some bids
        await auction.connect(accounts[1]).bid(wmatic.address, h.toWei("1"))
        await auction.connect(accounts[2]).bid(usdc.address, h.toWei("6"))
        await auction.connect(accounts[3]).bid(trb.address, h.toWei("1"))
        await auction.connect(accounts[4]).bid(usdc.address, h.toWei("11"))
        await auction.connect(accounts[5]).bid(usdc.address, h.toWei("12"))
        await auction.connect(accounts[1]).bid(usdc.address, h.toWei("13"))
        await auction.connect(accounts[2]).bid(usdc.address, h.toWei("14"))
        await auction.connect(accounts[3]).bid(wmatic.address, h.toWei("3"))
        await auction.connect(accounts[4]).bid(trb.address, h.toWei("2"))
        await auction.connect(accounts[5]).bid(usdc.address, h.toWei("21"))

        wmaticBids = h.toWei("4")
        usdcBids = h.toWei("77")
        trbBids = h.toWei("3")

        user1BalanceUsdc = await usdc.balanceOf(accounts[1].address)
        user2BalanceUsdc = await usdc.balanceOf(accounts[2].address)
        user3BalanceUsdc = await usdc.balanceOf(accounts[3].address)
        user4BalanceUsdc = await usdc.balanceOf(accounts[4].address)
        user5BalanceUsdc = await usdc.balanceOf(accounts[5].address)

        user1BalanceTrb = await trb.balanceOf(accounts[1].address)
        user2BalanceTrb = await trb.balanceOf(accounts[2].address)
        user3BalanceTrb = await trb.balanceOf(accounts[3].address)
        user4BalanceTrb = await trb.balanceOf(accounts[4].address)
        user5BalanceTrb = await trb.balanceOf(accounts[5].address)

        user1BalanceWmatic = await wmatic.balanceOf(accounts[1].address)
        user2BalanceWmatic = await wmatic.balanceOf(accounts[2].address)
        user3BalanceWmatic = await wmatic.balanceOf(accounts[3].address)
        user4BalanceWmatic = await wmatic.balanceOf(accounts[4].address)
        user5BalanceWmatic = await wmatic.balanceOf(accounts[5].address)

        assert(user1BalanceUsdc == h.toWei("87"), "user 1 usdc balance should be 87")
        assert(user2BalanceUsdc == h.toWei("80"), "user 2 usdc balance should be 80")
        assert(user3BalanceUsdc == h.toWei("100"), "user 3 usdc balance should be 100")
        assert(user4BalanceUsdc == h.toWei("89"), "user 4 usdc balance should be 89")
        assert(user5BalanceUsdc == h.toWei("67"), "user 5 usdc balance should be 67")

        assert(user1BalanceTrb == h.toWei("100"), "user 1 trb balance should be 100")
        assert(user2BalanceTrb == h.toWei("100"), "user 2 trb balance should be 100")
        assert(user3BalanceTrb == h.toWei("99"), "user 3 trb balance should be 99")
        assert(user4BalanceTrb == h.toWei("98"), "user 4 trb balance should be 98")
        assert(user5BalanceTrb == h.toWei("100"), "user 5 trb balance should be 100")

        assert(user1BalanceWmatic == h.toWei("99"), "user 1 wmatic balance should be 99")
        assert(user2BalanceWmatic == h.toWei("100"), "user 2 wmatic balance should be 100")
        assert(user3BalanceWmatic == h.toWei("97"), "user 3 wmatic balance should be 97")
        assert(user4BalanceWmatic == h.toWei("100"), "user 4 wmatic balance should be 100")
        assert(user5BalanceWmatic == h.toWei("100"), "user 5 wmatic balance should be 100")

        // advance time and end auction
        await h.advanceTime(86400 * 7)
        await auction.settle()

        // claim winner prize and verify balances
        await auction.connect(accounts[5]).claimWinnerPrize()

        user5BalanceUsdc = await usdc.balanceOf(accounts[5].address)
        user5BalanceTrb = await trb.balanceOf(accounts[5].address)
        user5BalanceWmatic = await wmatic.balanceOf(accounts[5].address)

        assert(user5BalanceUsdc == h.toWei("167"), "user 5 usdc balance should be 167")
        assert(user5BalanceTrb == h.toWei("110"), "user 5 trb balance should be 110")
        assert(user5BalanceWmatic == h.toWei("120"), "user 5 wmatic balance should be 120")

        // claim points
        await auction.connect(accounts[1]).claimPoints()
        await auction.connect(accounts[2]).claimPoints()
        await auction.connect(accounts[3]).claimPoints()
        await auction.connect(accounts[4]).claimPoints()
        await auction.connect(accounts[5]).claimPoints()

        // verify balances
        user1BalanceUsdc = await usdc.balanceOf(accounts[1].address)
        user2BalanceUsdc = await usdc.balanceOf(accounts[2].address)
        user3BalanceUsdc = await usdc.balanceOf(accounts[3].address)
        user4BalanceUsdc = await usdc.balanceOf(accounts[4].address)
        user5BalanceUsdc = await usdc.balanceOf(accounts[5].address)

        user1BalanceTrb = await trb.balanceOf(accounts[1].address)
        user2BalanceTrb = await trb.balanceOf(accounts[2].address)
        user3BalanceTrb = await trb.balanceOf(accounts[3].address)
        user4BalanceTrb = await trb.balanceOf(accounts[4].address)
        user5BalanceTrb = await trb.balanceOf(accounts[5].address)

        user1BalanceWmatic = await wmatic.balanceOf(accounts[1].address)
        user2BalanceWmatic = await wmatic.balanceOf(accounts[2].address)
        user3BalanceWmatic = await wmatic.balanceOf(accounts[3].address)
        user4BalanceWmatic = await wmatic.balanceOf(accounts[4].address)
        user5BalanceWmatic = await wmatic.balanceOf(accounts[5].address)

        expect(user1BalanceUsdc).to.equal(BigInt(h.toWei("87")) + BigInt(usdcBids) * BigInt(2) / BigInt(9), "user 1 usdc balance should be correct")
        expect(user2BalanceUsdc).to.equal(BigInt(h.toWei("80")) + BigInt(usdcBids) * BigInt(2) / BigInt(9), "user 2 usdc balance should be correct")
        expect(user3BalanceUsdc).to.equal(BigInt(h.toWei("100")) + BigInt(usdcBids) * BigInt(2) / BigInt(9), "user 3 usdc balance should be correct")
        expect(user4BalanceUsdc).to.equal(BigInt(h.toWei("89")) + BigInt(usdcBids) * BigInt(2) / BigInt(9), "user 4 usdc balance should be correct")
        expect(user5BalanceUsdc).to.equal(BigInt(h.toWei("167")) + BigInt(usdcBids) * BigInt(1) / BigInt(9), "user 5 usdc balance should be correct")

        expect(user1BalanceTrb).to.equal(BigInt(h.toWei("100")) + BigInt(trbBids) * BigInt(2) / BigInt(9), "user 1 trb balance should be correct")
        expect(user2BalanceTrb).to.equal(BigInt(h.toWei("100")) + BigInt(trbBids) * BigInt(2) / BigInt(9), "user 2 trb balance should be correct")
        expect(user3BalanceTrb).to.equal(BigInt(h.toWei("99")) + BigInt(trbBids) * BigInt(2) / BigInt(9), "user 3 trb balance should be correct")
        expect(user4BalanceTrb).to.equal(BigInt(h.toWei("98")) + BigInt(trbBids) * BigInt(2) / BigInt(9), "user 4 trb balance should be correct")
        expect(user5BalanceTrb).to.equal(BigInt(h.toWei("110")) + BigInt(trbBids) * BigInt(1) / BigInt(9), "user 5 trb balance should be correct")

        expect(user1BalanceWmatic).to.equal(BigInt(h.toWei("99")) + BigInt(wmaticBids) * BigInt(2) / BigInt(9), "user 1 wmatic balance should be correct")
        expect(user2BalanceWmatic).to.equal(BigInt(h.toWei("100")) + BigInt(wmaticBids) * BigInt(2) / BigInt(9), "user 2 wmatic balance should be correct")
        expect(user3BalanceWmatic).to.equal(BigInt(h.toWei("97")) + BigInt(wmaticBids) * BigInt(2) / BigInt(9), "user 3 wmatic balance should be correct")
        expect(user4BalanceWmatic).to.equal(BigInt(h.toWei("100")) + BigInt(wmaticBids) * BigInt(2) / BigInt(9), "user 4 wmatic balance should be correct")
        expect(user5BalanceWmatic).to.equal(BigInt(h.toWei("120")) + BigInt(wmaticBids) * BigInt(1) / BigInt(9), "user 5 wmatic balance should be correct")
    })
})