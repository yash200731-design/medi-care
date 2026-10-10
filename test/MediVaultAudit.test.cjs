const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MediVaultAudit Smart Contract", function () {
  let mediVault;
  let owner;
  let unauthorized;

  const mockConsentIdHash = ethers.keccak256(ethers.toUtf8Bytes("consent-uuid-101"));
  const mockPatientHash = ethers.keccak256(ethers.toUtf8Bytes("patient-uuid-202"));
  const mockDoctorHash = ethers.keccak256(ethers.toUtf8Bytes("doctor-uuid-303"));
  const mockDocSha256 = ethers.keccak256(ethers.toUtf8Bytes("file-content-sha256-404"));

  beforeEach(async function () {
    [owner, unauthorized] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MediVaultAudit");
    mediVault = await Factory.deploy();
    await mediVault.waitForDeployment();
  });

  describe("Deployment & Ownership", function () {
    it("should set deployer as the contract owner", async function () {
      expect(await mediVault.owner()).to.equal(owner.address);
    });

    it("should start with 0 recorded consents and 0 anchored documents", async function () {
      expect(await mediVault.totalConsentsRecorded()).to.equal(0n);
      expect(await mediVault.totalDocumentsAnchored()).to.equal(0n);
    });
  });

  describe("Consent Grants", function () {
    it("should allow owner to record a consent grant with future expiration", async function () {
      const latestTime = await time.latest();
      const expiresAt = latestTime + 3600; // 1 hour in the future

      await expect(
        mediVault.recordConsentGrant(
          mockConsentIdHash,
          mockPatientHash,
          mockDoctorHash,
          expiresAt
        )
      )
        .to.emit(mediVault, "ConsentGranted")
        .withArgs(
          mockConsentIdHash,
          mockPatientHash,
          mockDoctorHash,
          expiresAt,
          await time.latest() + 1
        );

      expect(await mediVault.totalConsentsRecorded()).to.equal(1n);

      const [isActive, isRevoked, exp] = await mediVault.isConsentActive(mockConsentIdHash);
      expect(isActive).to.be.true;
      expect(isRevoked).to.be.false;
      expect(exp).to.equal(BigInt(expiresAt));
    });

    it("should reject consent grant if caller is unauthorized", async function () {
      const latestTime = await time.latest();
      const expiresAt = latestTime + 3600;

      await expect(
        mediVault
          .connect(unauthorized)
          .recordConsentGrant(mockConsentIdHash, mockPatientHash, mockDoctorHash, expiresAt)
      ).to.be.revertedWith("MediVaultAudit: Caller is not the authorized owner");
    });

    it("should reject expiration in the past", async function () {
      const latestTime = await time.latest();
      const pastTime = latestTime - 100;

      await expect(
        mediVault.recordConsentGrant(
          mockConsentIdHash,
          mockPatientHash,
          mockDoctorHash,
          pastTime
        )
      ).to.be.revertedWith("MediVaultAudit: Expiration must be in the future");
    });

    it("should correctly identify expired consent after time travel", async function () {
      const latestTime = await time.latest();
      const expiresAt = latestTime + 3600;

      await mediVault.recordConsentGrant(
        mockConsentIdHash,
        mockPatientHash,
        mockDoctorHash,
        expiresAt
      );

      // Verify active
      let [isActive] = await mediVault.isConsentActive(mockConsentIdHash);
      expect(isActive).to.be.true;

      // Fast forward past expiration
      await time.increase(3601);

      [isActive] = await mediVault.isConsentActive(mockConsentIdHash);
      expect(isActive).to.be.false;
    });
  });

  describe("Consent Revocation", function () {
    it("should allow owner to revoke an active consent grant immediately", async function () {
      const latestTime = await time.latest();
      const expiresAt = latestTime + 7200;

      await mediVault.recordConsentGrant(
        mockConsentIdHash,
        mockPatientHash,
        mockDoctorHash,
        expiresAt
      );

      await expect(
        mediVault.recordConsentRevocation(mockConsentIdHash, mockPatientHash, mockDoctorHash)
      ).to.emit(mediVault, "ConsentRevoked");

      const [isActive, isRevoked] = await mediVault.isConsentActive(mockConsentIdHash);
      expect(isActive).to.be.false;
      expect(isRevoked).to.be.true;
    });

    it("should revert if revoking an already revoked consent", async function () {
      const latestTime = await time.latest();
      const expiresAt = latestTime + 7200;

      await mediVault.recordConsentGrant(
        mockConsentIdHash,
        mockPatientHash,
        mockDoctorHash,
        expiresAt
      );

      await mediVault.recordConsentRevocation(mockConsentIdHash, mockPatientHash, mockDoctorHash);

      await expect(
        mediVault.recordConsentRevocation(mockConsentIdHash, mockPatientHash, mockDoctorHash)
      ).to.be.revertedWith("MediVaultAudit: Consent is already revoked");
    });
  });

  describe("Document Integrity Anchoring", function () {
    it("should anchor document SHA-256 hash without revealing file contents", async function () {
      await expect(mediVault.recordDocumentIntegrity(mockDocSha256, mockPatientHash))
        .to.emit(mediVault, "DocumentAnchored")
        .withArgs(mockDocSha256, mockPatientHash, await time.latest() + 1);

      expect(await mediVault.totalDocumentsAnchored()).to.equal(1n);

      const [exists, patientHash] = await mediVault.verifyDocumentIntegrity(mockDocSha256);
      expect(exists).to.be.true;
      expect(patientHash).to.equal(mockPatientHash);
    });

    it("should reject re-anchoring of duplicate document hash", async function () {
      await mediVault.recordDocumentIntegrity(mockDocSha256, mockPatientHash);

      await expect(
        mediVault.recordDocumentIntegrity(mockDocSha256, mockPatientHash)
      ).to.be.revertedWith("MediVaultAudit: Document hash already anchored");
    });
  });
});
