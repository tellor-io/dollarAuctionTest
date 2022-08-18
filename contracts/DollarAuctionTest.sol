// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import './interfaces/IERC20.sol';
import 'usingtellor/contracts/UsingTellor.sol';

contract DollarAuctionTest is UsingTellor {
    uint256 public topBidUsd; // should this adjust based on the current price?
    address public topBidder;
    uint256 public totalPoints;
    uint256 public endTimestamp;
    bool public settled;

    mapping(address => uint256) public points;
    mapping(address => Token) public tokens;

    address[] public tokenAddresses;

    struct Token {
        bool isApproved;
        uint256 totalBids;
        uint256 prizePoolAmount;
        bytes32 queryId;
    }

    constructor(
        address payable _tellor, 
        address[] memory _tokens, 
        bytes32[] memory _queryIds) 
        UsingTellor(_tellor) {
        require(_tokens.length == _queryIds.length, "Number of tokens and queryIds must match");
        for (uint256 i = 0; i < _tokens.length; i++) {
            Token storage token = tokens[_tokens[i]];
            token.isApproved = true;
            token.queryId = _queryIds[i];
            tokenAddresses.push(_tokens[i]);
        }
        endTimestamp = block.timestamp + 1 weeks;
    }

    function bid(address _tokenAddress, uint256 _amount) public {
        require(block.timestamp < endTimestamp, "Auction has ended");
        Token storage _token = tokens[_tokenAddress];
        require(_token.isApproved, "Invalid token");
        uint256 _bidUsd = _getTokenPrice(_tokenAddress) * _amount / 1e18;
        require(_bidUsd - 1e18 > topBidUsd, "Bid too low"); // 1 dollar minimum increment
        _token.totalBids += _amount;
        points[msg.sender]++;
        totalPoints++;
        topBidUsd = _bidUsd;
        topBidder = msg.sender;
    }

    function fundPoolWithoutTimeExtension(address _tokenAddress, uint256 _amount) public {
        _fundPool(_tokenAddress, _amount);
    }

    function fundPoolWithTimeExtension(address _tokenAddress, uint256 _amount) public {
        uint256 _tokenPrice = _getTokenPrice(_tokenAddress);
        uint256 _prizePoolUsd = _getPrizePoolUsd();
        uint256 _percentageOfPrizePool = _amount * _tokenPrice / _prizePoolUsd;
        require(_percentageOfPrizePool >= 10e18, "Amount too low"); // 10% of the prize pool
        endTimestamp += 3 days;
        _fundPool(_tokenAddress, _amount);
    }

    function settle() public {
        require(block.timestamp > endTimestamp, "Auction not over");
        require(!settled, "Auction already settled");
        totalPoints--;
        points[topBidder]--;
    }

    function claimPoints() public {
        require(settled, "Auction not settled");
        require(points[msg.sender] > 0, "No points to claim");
        for(uint256 _i = 0; _i < tokenAddresses.length; _i++) {
            Token storage _token = tokens[tokenAddresses[_i]];
            if(_token.totalBids > 0) {
                uint256 _amount = _token.totalBids * points[msg.sender] / totalPoints;
                IERC20(tokenAddresses[_i]).transfer(msg.sender, _amount);
            }
        }
        points[msg.sender] = 0;
    }

    function claimWinnerPrize() public {
        require(settled, "Auction not settled");
        require(msg.sender == topBidder, "Not top bidder");
        for(uint256 _i = 0; _i < tokenAddresses.length; _i++) {
            Token storage _token = tokens[tokenAddresses[_i]];
            if(_token.prizePoolAmount > 0) {
                IERC20(tokenAddresses[_i]).transfer(msg.sender, _token.prizePoolAmount);
                _token.prizePoolAmount = 0;
            }
        }
    }

    // Internal functions
    /**
     * @dev Internal function to read if a reward has been claimed
     * @param _b bytes value to convert to uint256
     * @return _number uint256 converted from bytes
     */
    function _bytesToUint(bytes memory _b) internal pure returns(uint256 _number){
        for (uint256 _i = 0; _i < _b.length; _i++) {
            _number = _number * 256 + uint8(_b[_i]);
        }
    }

    function _fundPool(address _tokenAddress, uint256 _amount) internal {
        require(block.timestamp < endTimestamp, "Auction has ended");
        Token storage _token = tokens[_tokenAddress];
        require(_token.isApproved, "Invalid token");
        _token.prizePoolAmount += _amount;
        require(IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
    }

    function _getTokenPrice(address _tokenAddress) internal view returns(uint256) {
        Token storage _token = tokens[_tokenAddress];
        (, bytes memory _priceBytes, uint256 _timestampRetrieved) = getDataBefore(_token.queryId, block.timestamp - 2 hours);
        require(_timestampRetrieved > 0, "No data returned from oracle");
        return _bytesToUint(_priceBytes);
    }

    // returns prize pool USD value with 18 decimals
    function _getPrizePoolUsd() internal view returns(uint256) {
        uint256 _prizePoolUsd = 0;
        for(uint256 _i = 0; _i < tokenAddresses.length; _i++) {
            Token storage _token = tokens[tokenAddresses[_i]];
            _prizePoolUsd += _token.prizePoolAmount * _getTokenPrice(tokenAddresses[_i]) / 1e18;
        }
        return _prizePoolUsd;
    }
}