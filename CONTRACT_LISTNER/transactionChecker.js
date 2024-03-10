const ethers = require('ethers');
const flare = require('@flarenetwork/flare-periphery-contract-artifacts');
const utils = require('@flarenetwork/flare-periphery-contract-artifacts/dist/coston/StateConnector/libs/ts/utils.js');

const FLARE_RPC = "https://coston-api.flare.network/ext/C/rpc";
const ATTESTATION_PROVIDER_URL = "https://evm-verifier.flare.network";
const ATTESTATION_PROOF_URL = "https://attestation-coston.flare.network"
const ATTESTATION_PROVIDER_API_KEY = "123456";
const FLARE_CONTRACT_REGISTRY_ADDR = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

const PRIVATE_KEY = "0x6607fc65548ffe231ce954018b3ee01fedb242281227e42a30a9bffa759557d7";

async function runAddressValidity(network, transactionHash) {
  const VERIFICATION_ENDPOINT = `${ATTESTATION_PROVIDER_URL}/verifier/${network.toLowerCase()}/EVMTransaction/prepareRequest`;
  const ATTESTATION_ENDPOINT = `${ATTESTATION_PROOF_URL}/attestation-client/api/proof/get-specific-proof`;

  const provider = new ethers.JsonRpcProvider(FLARE_RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const { encodeAttestationName } = utils;
  const rawAttestationRequest = {
    attestationType: encodeAttestationName("EVMTransaction"),
    sourceId: encodeAttestationName(`test${network.toUpperCase()}`),
    requestBody: {
      requiredConfirmations: "1",
      provideInput: true,
      listEvents: true,
      logIndices: [],
      transactionHash: transactionHash,
    },
  };

  console.log("Preparing attestation request using verifier", ATTESTATION_PROVIDER_URL, "...");
  console.log("Request:", rawAttestationRequest);

  const verifierResponse = await fetch(VERIFICATION_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": ATTESTATION_PROVIDER_API_KEY,
    },
    body: JSON.stringify(rawAttestationRequest),
  });

  var response = await verifierResponse
  console.log(response)
  const encodedAttestationRequest = await response.json();

  if (encodedAttestationRequest.status !== "VALID") {
    console.log("Received error:", encodedAttestationRequest);
    return;
  }
  console.log("  Received encoded attestation request:", encodedAttestationRequest.abiEncodedRequest);

  const flareContractRegistry = new ethers.Contract(FLARE_CONTRACT_REGISTRY_ADDR, flare.nameToAbi("FlareContractRegistry", "coston").data, provider);
  const stateConnectorAddress = await flareContractRegistry.getContractAddressByName("StateConnector");
  const stateConnector = new ethers.Contract(stateConnectorAddress, flare.nameToAbi("StateConnector", "coston").data, signer);

  console.log("Submitting attestation to State Connector...");
  const attestationTx = await stateConnector.requestAttestations(encodedAttestationRequest.abiEncodedRequest);
  const receipt = await attestationTx.wait();
  const block = await provider.getBlock(receipt.blockNumber);

  const roundOffset = await stateConnector.BUFFER_TIMESTAMP_OFFSET();
  const roundDuration = await stateConnector.BUFFER_WINDOW();
  const submissionRoundID = Number((BigInt(block.timestamp) - roundOffset) / roundDuration);
  console.log("  Attestation submitted in round", submissionRoundID);

  var prevFinalizedRoundID = 0;
  setTimeout(async function poll() {
    const lastFinalizedRoundID = Number(await stateConnector.lastFinalizedRoundId());
    if (prevFinalizedRoundID != lastFinalizedRoundID) {
      console.log("  Last finalized round is", lastFinalizedRoundID);
      prevFinalizedRoundID = lastFinalizedRoundID;
    }
    if (lastFinalizedRoundID < submissionRoundID) {
      setTimeout(poll, 10000);
      return;
    }

    const proofRequest = {
      roundId: submissionRoundID,
      requestBytes: encodedAttestationRequest.abiEncodedRequest,
    };

    console.log("Retrieving proof from attestation provider...");
    const providerResponse = await fetch(ATTESTATION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": ATTESTATION_PROVIDER_API_KEY,
      },
      body: JSON.stringify(proofRequest),
    });
    const proof = await providerResponse.json();
    if (proof.status !== "OK") {
      console.log("Received error:", proof);
      return;
    }
    console.log("  Received Merkle proof:", proof.data.merkleProof);

    const fullProof = {
        merkleProof: proof.data.merkleProof,
        data: {
            ...proof.data,
            ...proof.data.request,
            ...proof.data.response,
            status: proof.status,
        }
    };

    const { isValid } = fullProof.data.responseBody;

    console.log("Sending the proof for verification...");

    const addressVerifier = new ethers.Contract(
      flare.nameToAddress("IAddressValidityVerification", "coston"),
      flare.nameToAbi("IAddressValidityVerification", "coston").data,
      signer
    );
    const isVerified = await addressVerifier.verifyAddressValidity(fullProof);
    console.log("  Attestation result:", isVerified);

    if (isVerified) {
      console.log(
        isValid
          ? "Attestation providers agree that the address is valid."
          : "Attestation providers agree that the address is invalid."
      );
    } else {
      console.log("Could not verify attestation. Validity of address is unknown.");
    }
  }, 10000);
}

module.exports = {
    runAddressValidity
};