// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MediVaultAudit
 * @notice Immutable blockchain audit trail for Patient-Controlled Medical Records.
 * @dev PRIVACY GUARANTEE: Never stores medical records or Patient Health Information (PHI/PII).
 *      Only anonymized cryptographic hashes (SHA-256 / Keccak-256) of consent IDs,
 *      patient IDs, doctor IDs, and document integrity hashes are stored.
 */
contract MediVaultAudit {
    struct ConsentRecord {
        bytes32 consentIdHash;
        bytes32 patientHash;
        bytes32 doctorHash;
        uint256 expiresAt;
        bool isRevoked;
        uint256 createdAt;
        uint256 revokedAt;
        bool exists;
    }

    struct DocumentIntegrityRecord {
        bytes32 documentSha256;
        bytes32 patientHash;
        uint256 timestamp;
        bool exists;
    }

    address public owner;
    uint256 public totalConsentsRecorded;
    uint256 public totalDocumentsAnchored;

    // Mapping from consentIdHash => ConsentRecord
    mapping(bytes32 => ConsentRecord) public consents;

    // Mapping from documentSha256 => DocumentIntegrityRecord
    mapping(bytes32 => DocumentIntegrityRecord) public documents;

    // Events for transparent audit log indexing
    event ConsentGranted(
        bytes32 indexed consentIdHash,
        bytes32 indexed patientHash,
        bytes32 indexed doctorHash,
        uint256 expiresAt,
        uint256 timestamp
    );

    event ConsentRevoked(
        bytes32 indexed consentIdHash,
        bytes32 indexed patientHash,
        bytes32 indexed doctorHash,
        uint256 revokedAt,
        uint256 timestamp
    );

    event DocumentAnchored(
        bytes32 indexed documentSha256,
        bytes32 indexed patientHash,
        uint256 timestamp
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "MediVaultAudit: Caller is not the authorized owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "MediVaultAudit: New owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Records an approved time-limited consent grant on-chain.
     * @param consentIdHash Hash of the consent grant unique identifier
     * @param patientHash Hash of the granting patient's ID
     * @param doctorHash Hash of the granted doctor's ID
     * @param expiresAt Unix timestamp when this consent will automatically expire
     */
    function recordConsentGrant(
        bytes32 consentIdHash,
        bytes32 patientHash,
        bytes32 doctorHash,
        uint256 expiresAt
    ) external onlyOwner {
        require(consentIdHash != bytes32(0), "MediVaultAudit: Invalid consent hash");
        require(patientHash != bytes32(0), "MediVaultAudit: Invalid patient hash");
        require(doctorHash != bytes32(0), "MediVaultAudit: Invalid doctor hash");
        require(expiresAt > block.timestamp, "MediVaultAudit: Expiration must be in the future");
        require(!consents[consentIdHash].exists, "MediVaultAudit: Consent record already exists");

        consents[consentIdHash] = ConsentRecord({
            consentIdHash: consentIdHash,
            patientHash: patientHash,
            doctorHash: doctorHash,
            expiresAt: expiresAt,
            isRevoked: false,
            createdAt: block.timestamp,
            revokedAt: 0,
            exists: true
        });

        totalConsentsRecorded += 1;

        emit ConsentGranted(
            consentIdHash,
            patientHash,
            doctorHash,
            expiresAt,
            block.timestamp
        );
    }

    /**
     * @notice Records an immediate patient revocation of an active consent grant.
     * @param consentIdHash Hash of the consent grant to revoke
     * @param patientHash Hash of the revoking patient
     * @param doctorHash Hash of the doctor whose access is being revoked
     */
    function recordConsentRevocation(
        bytes32 consentIdHash,
        bytes32 patientHash,
        bytes32 doctorHash
    ) external onlyOwner {
        require(consents[consentIdHash].exists, "MediVaultAudit: Consent not found");
        require(!consents[consentIdHash].isRevoked, "MediVaultAudit: Consent is already revoked");

        consents[consentIdHash].isRevoked = true;
        consents[consentIdHash].revokedAt = block.timestamp;

        emit ConsentRevoked(
            consentIdHash,
            patientHash,
            doctorHash,
            block.timestamp,
            block.timestamp
        );
    }

    /**
     * @notice Records the cryptographic SHA-256 digest of an uploaded medical document.
     * @dev Ensures integrity proof without ever revealing document contents or patient metadata.
     * @param documentSha256 SHA-256 hash of the medical file
     * @param patientHash Anonymized hash of the patient owning the document
     */
    function recordDocumentIntegrity(
        bytes32 documentSha256,
        bytes32 patientHash
    ) external onlyOwner {
        require(documentSha256 != bytes32(0), "MediVaultAudit: Invalid document hash");
        require(patientHash != bytes32(0), "MediVaultAudit: Invalid patient hash");
        require(!documents[documentSha256].exists, "MediVaultAudit: Document hash already anchored");

        documents[documentSha256] = DocumentIntegrityRecord({
            documentSha256: documentSha256,
            patientHash: patientHash,
            timestamp: block.timestamp,
            exists: true
        });

        totalDocumentsAnchored += 1;

        emit DocumentAnchored(documentSha256, patientHash, block.timestamp);
    }

    /**
     * @notice Verifies whether a document SHA-256 hash is anchored on the ledger.
     */
    function verifyDocumentIntegrity(bytes32 documentSha256)
        external
        view
        returns (bool exists, bytes32 patientHash, uint256 timestamp)
    {
        DocumentIntegrityRecord memory doc = documents[documentSha256];
        return (doc.exists, doc.patientHash, doc.timestamp);
    }

    /**
     * @notice Verifies if a consent grant is currently valid (exists, not revoked, and not expired).
     */
    function isConsentActive(bytes32 consentIdHash)
        external
        view
        returns (bool isActive, bool isRevoked, uint256 expiresAt)
    {
        ConsentRecord memory c = consents[consentIdHash];
        if (!c.exists) {
            return (false, false, 0);
        }
        bool active = (!c.isRevoked && block.timestamp < c.expiresAt);
        return (active, c.isRevoked, c.expiresAt);
    }

    /**
     * @notice Returns full details for a recorded consent grant.
     */
    function getConsent(bytes32 consentIdHash)
        external
        view
        returns (ConsentRecord memory)
    {
        require(consents[consentIdHash].exists, "MediVaultAudit: Consent not found");
        return consents[consentIdHash];
    }
}
