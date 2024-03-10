# Firelink Bridge
## We deployed 2 smart contracts which act as gateways.
Contract Addresses:
Sepolia 0x68eDBdF3614F802D6fF34a74A3DBF4f97910754a
Coston 0xF6b29cF96471e9bfbBb52623395759CA948f4554

## Minting and Burning tokens
We created an interface which ERC20 Tokens must implement to be able to be bridged (it allows the gateway contract to mint and burn tokens to prevent penetration tests)

### How the gateways work
The gateways take a proof which they valdiate before minting the funds in the chosen wallet when the Contract on the initial chain was triggererd.

The Address of an example ERC20Mintable token (on Coston): 0xb2A0aD1146eC9843908836a2D166D5624AA32471

## How the Gateways get triggered
**The code for spinning up a node can be found in the repository. It picks up events, creates an AttestationRequest by calling Flares APIs.
It then calls the StateConnector contract passing in the attestion Request (it waits for the attestation round to have finished before doing so). 
Finally the node calls the gateway contract and passes the merkleProof**

Independently ran nodes are repsponsible for calling the flare api's and creating the AttestationRequests and generating te proof which they pass on to the Second chain's gateway contract.

The nodes are reacting to events which the gateway contracts release. The events contain the sending address, receiver address, and amount being burned. 
