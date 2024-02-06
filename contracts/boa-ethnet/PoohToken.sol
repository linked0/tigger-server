// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PoohToken is ERC20, Ownable {
    uint8 public constant DECIMALS = 7;
    uint256 public constant INITIAL_SUPPLY = 5421301301958463;

    constructor() ERC20("POOHTOKEN", "POO") Ownable () {
        _mint(msg.sender, INITIAL_SUPPLY * (10 ** uint256(DECIMALS)));
    }

    // Function to mint tokens
    // Only the owner of the contract (the one who deployed it) can call this function
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
