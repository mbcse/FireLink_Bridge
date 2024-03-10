# Firelink Bridge
Contract Addresses:
Sepolia 0x68eDBdF3614F802D6fF34a74A3DBF4f97910754a
Coston 0xF6b29cF96471e9bfbBb52623395759CA948f4554

The Address of the example ERC20Mintable token (on Coston): 0xb2A0aD1146eC9843908836a2D166D5624AA32471


We deployed 2 smart contracts which act as gateways.

These gateways take a proof which they valdiate before minting the funds in the chosen wallet when the Contract on the initial chain was triggererd.

independently ran nodes are repsponsible for calling the flare api's and creating the AttestationRequests and generating te proof which they pass on to the Second chain's gateway contract.
