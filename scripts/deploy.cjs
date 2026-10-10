const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying MediVaultAudit smart contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const MediVaultAudit = await ethers.getContractFactory("MediVaultAudit");
  const contract = await MediVaultAudit.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("MediVaultAudit deployed successfully to:", contractAddress);

  // Write deployment info for backend and frontend reference
  const deploymentData = {
    address: contractAddress,
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.join(__dirname, "../src/lib/blockchain");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, "deployment.json"),
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("Deployment info written to src/lib/blockchain/deployment.json");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
