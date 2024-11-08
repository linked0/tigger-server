#!/bin/sh

rm -rf contracts
mkdir contracts
cp -r ./poo-ethnet/contracts contracts/boa-ethnet
cp -r ./tigger-bridge/contracts/bridge contracts/bridge
mkdir contracts/openzeppelin-solidity
mkdir contracts/openzeppelin-solidity/contracts
