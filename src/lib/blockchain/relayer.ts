import { ethers } from 'ethers';
import { generateMockTxHash, toBytes32Hash } from './utils';
import { BlockchainTxStatus } from '@/types';

// ABI for the MediVaultAudit contract functions we call
export const MEDIVAULT_AUDIT_ABI = [
  'function owner() external view returns (address)',
  'function recordConsentGrant(bytes32 consentIdHash, bytes32 patientHash, bytes32 doctorHash, uint256 expiresAt) external',
  'function recordConsentRevocation(bytes32 consentIdHash, bytes32 patientHash, bytes32 doctorHash) external',
  'function recordDocumentIntegrity(bytes32 documentSha256, bytes32 patientHash) external',
  'function verifyDocumentIntegrity(bytes32 documentSha256) external view returns (bool exists, bytes32 patientHash, uint256 timestamp)',
  'function isConsentActive(bytes32 consentIdHash) external view returns (bool isActive, bool isRevoked, uint256 expiresAt)',
  'event ConsentGranted(bytes32 indexed consentIdHash, bytes32 indexed patientHash, bytes32 indexed doctorHash, uint256 expiresAt, uint256 timestamp)',
  'event ConsentRevoked(bytes32 indexed consentIdHash, bytes32 indexed patientHash, bytes32 indexed doctorHash, uint256 revokedAt, uint256 timestamp)',
  'event DocumentAnchored(bytes32 indexed documentSha256, bytes32 indexed patientHash, uint256 timestamp)',
];

export interface RelayedTxResult {
  status: BlockchainTxStatus;
  transactionHash: string | null;
  blockNumber: number | null;
  confirmed: boolean;
  isSimulated: boolean;
  label: string;
  error?: string;
}

export class BlockchainRelayer {
  private static getContract(): { contract: ethers.Contract; signer: ethers.Wallet; provider: ethers.JsonRpcProvider } | null {
    try {
      const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
      const contractAddress = process.env.NEXT_PUBLIC_MEDIVAULT_CONTRACT_ADDRESS;
      const privateKey = process.env.BLOCKCHAIN_RELAYER_PRIVATE_KEY;

      if (!rpcUrl || !contractAddress || !privateKey) {
        return null;
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const signer = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(contractAddress, MEDIVAULT_AUDIT_ABI, signer);

      return { contract, signer, provider };
    } catch {
      return null;
    }
  }

  private static isSimulationEnabled(): boolean {
    return (
      process.env.ENABLE_BLOCKCHAIN_SIMULATION === 'true' ||
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
      !process.env.BLOCKCHAIN_RPC_URL
    );
  }

  /**
   * Records a consent grant on the blockchain.
   * STRICT REQUIREMENT: Only confirmed if validated with real on-chain receipt (receipt.status === 1).
   * Never sets confirmed: true for simulations or unconfirmed transactions.
   */
  static async recordConsentGrant(
    grantId: string,
    patientId: string,
    doctorId: string,
    expiresAtUnix: number
  ): Promise<RelayedTxResult> {
    const live = this.getContract();

    if (live) {
      try {
        const consentHash = toBytes32Hash(grantId);
        const patientHash = toBytes32Hash(patientId);
        const doctorHash = toBytes32Hash(doctorId);

        const tx = await live.contract.recordConsentGrant(
          consentHash,
          patientHash,
          doctorHash,
          expiresAtUnix
        );

        // Wait for genuine on-chain block receipt
        const receipt = await tx.wait(1);

        if (receipt && receipt.status === 1) {
          return {
            status: 'confirmed',
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            confirmed: true,
            isSimulated: false,
            label: 'Confirmed on Ethereum ledger',
          };
        } else {
          return {
            status: 'failed',
            transactionHash: tx.hash,
            blockNumber: null,
            confirmed: false,
            isSimulated: false,
            label: 'Transaction reverted on-chain',
            error: 'Execution reverted by EVM.',
          };
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Blockchain transaction error';
        if (!this.isSimulationEnabled()) {
          return {
            status: 'failed',
            transactionHash: null,
            blockNumber: null,
            confirmed: false,
            isSimulated: false,
            label: 'Transaction submission failed',
            error: errMsg,
          };
        }
      }
    }

    // Explicitly labeled simulation mode - NEVER claims confirmed: true!
    if (this.isSimulationEnabled()) {
      return {
        status: 'simulated',
        transactionHash: generateMockTxHash(),
        blockNumber: null,
        confirmed: false, // Strict: Simulation is NEVER marked confirmed!
        isSimulated: true,
        label: '[SIMULATED - NO ON-CHAIN RECEIPT]',
      };
    }

    return {
      status: 'failed',
      transactionHash: null,
      blockNumber: null,
      confirmed: false,
      isSimulated: false,
      label: 'Blockchain relayer unavailable',
      error: 'No active Ethereum RPC connection and simulation is disabled.',
    };
  }

  /**
   * Records a consent revocation on the blockchain.
   */
  static async recordConsentRevocation(
    grantId: string,
    patientId: string,
    doctorId: string
  ): Promise<RelayedTxResult> {
    const live = this.getContract();

    if (live) {
      try {
        const consentHash = toBytes32Hash(grantId);
        const patientHash = toBytes32Hash(patientId);
        const doctorHash = toBytes32Hash(doctorId);

        const tx = await live.contract.recordConsentRevocation(consentHash, patientHash, doctorHash);
        const receipt = await tx.wait(1);

        if (receipt && receipt.status === 1) {
          return {
            status: 'confirmed',
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            confirmed: true,
            isSimulated: false,
            label: 'Confirmed on Ethereum ledger',
          };
        } else {
          return {
            status: 'failed',
            transactionHash: tx.hash,
            blockNumber: null,
            confirmed: false,
            isSimulated: false,
            label: 'Revocation transaction reverted on-chain',
            error: 'Revocation reverted.',
          };
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Blockchain error';
        if (!this.isSimulationEnabled()) {
          return {
            status: 'failed',
            transactionHash: null,
            blockNumber: null,
            confirmed: false,
            isSimulated: false,
            label: 'Revocation failed',
            error: errMsg,
          };
        }
      }
    }

    if (this.isSimulationEnabled()) {
      return {
        status: 'simulated',
        transactionHash: generateMockTxHash(),
        blockNumber: null,
        confirmed: false,
        isSimulated: true,
        label: '[SIMULATED - NO ON-CHAIN RECEIPT]',
      };
    }

    return {
      status: 'failed',
      transactionHash: null,
      blockNumber: null,
      confirmed: false,
      isSimulated: false,
      label: 'Blockchain relayer unavailable',
      error: 'No RPC connection.',
    };
  }

  /**
   * Anchors document integrity SHA-256 digest on the blockchain.
   */
  static async recordDocumentIntegrity(
    documentSha256: string,
    patientId: string
  ): Promise<RelayedTxResult> {
    const live = this.getContract();

    if (live) {
      try {
        const docHash = toBytes32Hash(documentSha256);
        const patientHash = toBytes32Hash(patientId);

        const tx = await live.contract.recordDocumentIntegrity(docHash, patientHash);
        const receipt = await tx.wait(1);

        if (receipt && receipt.status === 1) {
          return {
            status: 'confirmed',
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            confirmed: true,
            isSimulated: false,
            label: 'Confirmed on Ethereum ledger',
          };
        } else {
          return {
            status: 'failed',
            transactionHash: tx.hash,
            blockNumber: null,
            confirmed: false,
            isSimulated: false,
            label: 'Document anchoring reverted',
            error: 'Anchoring reverted.',
          };
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Blockchain error';
        if (!this.isSimulationEnabled()) {
          return {
            status: 'failed',
            transactionHash: null,
            blockNumber: null,
            confirmed: false,
            isSimulated: false,
            label: 'Document anchoring failed',
            error: errMsg,
          };
        }
      }
    }

    if (this.isSimulationEnabled()) {
      return {
        status: 'simulated',
        transactionHash: generateMockTxHash(),
        blockNumber: null,
        confirmed: false,
        isSimulated: true,
        label: '[SIMULATED - NO ON-CHAIN RECEIPT]',
      };
    }

    return {
      status: 'failed',
      transactionHash: null,
      blockNumber: null,
      confirmed: false,
      isSimulated: false,
      label: 'Blockchain relayer unavailable',
      error: 'No RPC connection.',
    };
  }
}
