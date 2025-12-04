/**
 * TypeScript interfaces for ChannelSignal Firestore entities.
 */

/**
 * Represents a contact associated with a deal.
 */
export interface DealContact {
  /** Contact's display name */
  name: string;
  /** Contact's email address */
  email: string;
  /** Role in the email thread */
  role: 'sender' | 'recipient' | 'cc';
}

/**
 * Status of a deal in the pipeline.
 */
export type DealStatus =
  | 'new'
  | 'active'
  | 'stalled'
  | 'won'
  | 'lost'
  | 'archived';

/**
 * Source of the deal data.
 */
export type DealSource = 'bcc' | 'screenshot';

/**
 * Supported currency codes for deal amounts.
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'CHF';

/**
 * Represents a deal tracked in the system.
 */
export interface Deal {
  /** Unique identifier (Firestore document ID) */
  id: string;
  /** Email subject or screenshot title */
  subject: string;
  /** Deal value (null if not extracted) */
  amount: number | null;
  /** Currency of the deal amount */
  currency: CurrencyCode;
  /** List of contacts involved in the deal */
  contacts: DealContact[];
  /** Parent organization ID */
  organizationId: string;
  /** How this deal was ingested */
  source: DealSource;
  /** Raw email content or OCR text from screenshot */
  rawContent: string;
  /** Timestamp when deal was extracted/created */
  extractedAt: Date;
  /** Current status of the deal */
  status: DealStatus;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Member role within an organization.
 */
export type MemberRole = 'owner' | 'admin' | 'member';

/**
 * Represents a member of an organization.
 */
export interface OrganizationMember {
  /** User ID reference */
  userId: string;
  /** Member's email address */
  email: string;
  /** Role within the organization */
  role: MemberRole;
  /** When the member joined */
  joinedAt: Date;
}

/**
 * Represents an organization (team/company).
 */
export interface Organization {
  /** Unique identifier (Firestore document ID) */
  id: string;
  /** Organization display name */
  name: string;
  /** Unique BCC address for email ingestion (e.g., deals-abc123@channelsignal.app) */
  bccAddress: string;
  /** List of organization members */
  members: OrganizationMember[];
  /** When the organization was created */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Firestore document data types (without the 'id' field which is the doc ID).
 */
export type DealData = Omit<Deal, 'id'>;
export type OrganizationData = Omit<Organization, 'id'>;

/**
 * Input types for creating new entities.
 */
export type CreateDealInput = Omit<Deal, 'id' | 'extractedAt' | 'updatedAt'>;
export type CreateOrganizationInput = Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>;
