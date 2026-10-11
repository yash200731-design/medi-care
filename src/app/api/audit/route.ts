import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth/server';
import { AuditService } from '@/lib/dal/audit';
import { getPersistenceMetadata } from '@/lib/dal/persistence';
import { ethers } from 'ethers';

async function getLiveBlockchainStatus() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_MEDIVAULT_CONTRACT_ADDRESS;

  if (!rpcUrl || !contractAddress) {
    return {
      connected: false,
      simulated: true,
      network: 'Local Simulation Mode (No Ethereum RPC Configured)',
      latestBlock: null,
      message: 'Blockchain confirmations are currently simulated. Configure BLOCKCHAIN_RPC_URL for live network integration.',
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    return {
      connected: true,
      simulated: false,
      network: `${network.name} (Chain ID: ${network.chainId})`,
      latestBlock: blockNumber,
      message: 'Connected to live EVM network.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'RPC unreachable';
    return {
      connected: false,
      simulated: true,
      network: 'Disconnected (RPC connection failed)',
      latestBlock: null,
      message: `Failed to connect to ${rpcUrl}: ${msg}`,
    };
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    // Retrieve scoped audit events via AuditService
    const visibleEvents = await AuditService.getEventsForUser(user.id, user.role);
    const blockchainStatus = await getLiveBlockchainStatus();

    return NextResponse.json({
      events: visibleEvents,
      totalCount: visibleEvents.length,
      blockchainStatus,
      persistence: getPersistenceMetadata(),
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message, persistence: getPersistenceMetadata() }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve audit events.', persistence: getPersistenceMetadata() }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { documentSha256 } = body;

    if (!documentSha256) {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'documentSha256 is required.', persistence: getPersistenceMetadata() }, { status: 400 });
    }

    const cleanHash = documentSha256.toLowerCase().trim();
    const result = await AuditService.verifyDocumentIntegrity(cleanHash);

    if (result.verified && result.record) {
      return NextResponse.json({
        verified: true,
        documentSha256: cleanHash,
        title: result.record.title,
        patientName: result.record.patientName,
        anchoredAt: result.record.createdAt,
        blockchainTxHash: result.record.blockchainTxHash,
        status: 'AUTHENTIC & UNTAMPERED',
        message: 'Cryptographic SHA-256 hash verified against authoritative anchored record state.',
        persistence: getPersistenceMetadata(),
      });
    }

    return NextResponse.json({
      verified: false,
      documentSha256: cleanHash,
      status: 'NOT_FOUND_OR_ALTERED',
      message: 'Hash not recognized in registry or document may have been tampered with.',
      persistence: getPersistenceMetadata(),
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message, persistence: getPersistenceMetadata() }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Verification failed.', persistence: getPersistenceMetadata() }, { status: 500 });
  }
}
