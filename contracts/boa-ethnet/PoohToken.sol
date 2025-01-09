// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PoohToken is ERC20, Ownable {
    
    uint256 public MINTED_AMOUNT = 5 ether;
    
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _mint(msg.sender, 123456789000000000000000000000000);
    }
    
    function mintTokens() public {
        // Mints the defined amount of tokens for the caller
        _mint(msg.sender, MINTED_AMOUNT);
    }
    
}