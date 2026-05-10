/**
 * Tipos da Pluggy API — apenas os campos que consumimos.
 * Doc oficial: https://docs.pluggy.ai
 */

export type PluggyItemStatus =
  | "UPDATED"
  | "UPDATING"
  | "WAITING_USER_INPUT"
  | "LOGIN_ERROR"
  | "OUTDATED"
  | "ERROR";

export interface PluggyConnector {
  id: number;
  name: string;
  institutionUrl?: string;
  imageUrl?: string;
  primaryColor?: string;
  type?: string;
  country?: string;
}

export interface PluggyItem {
  id: string;
  connector: PluggyConnector;
  status: PluggyItemStatus;
  statusDetail?: unknown;
  executionStatus?: string;
  createdAt: string;
  updatedAt: string;
  lastUpdatedAt?: string;
  consentExpiresAt?: string;
  clientUserId?: string | null;
}

export type PluggyAccountType =
  | "BANK"
  | "CREDIT"
  | "INVESTMENT"
  | "LOAN";

export type PluggyAccountSubtype =
  | "CHECKING_ACCOUNT"
  | "SAVINGS_ACCOUNT"
  | "CREDIT_CARD"
  | string;

export interface PluggyAccount {
  id: string;
  itemId: string;
  type: PluggyAccountType;
  subtype?: PluggyAccountSubtype;
  name: string;
  marketingName?: string | null;
  number?: string | null;
  balance: number;
  currencyCode: string;
  owner?: string | null;
  taxNumber?: string | null;
  creditData?: {
    level?: string | null;
    brand?: string | null;
    balanceCloseDate?: string | null;
    balanceDueDate?: string | null;
    availableCreditLimit?: number | null;
    creditLimit?: number | null;
    minimumPayment?: number | null;
  } | null;
  bankData?: {
    transferNumber?: string | null;
    closingBalance?: number | null;
  } | null;
}

export interface PluggyCreditCardMetadata {
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  totalAmount?: number | null;
  payeeMCC?: number | null;
  cardNumber?: string | null;
}

export interface PluggyMerchant {
  name?: string | null;
  businessName?: string | null;
  cnpj?: string | null;
  cnae?: string | null;
}

export interface PluggyPaymentData {
  payer?: { name?: string | null; documentNumber?: { value?: string | null } | null } | null;
  receiver?: { name?: string | null; documentNumber?: { value?: string | null } | null } | null;
  reason?: string | null;
}

export interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  descriptionRaw?: string | null;
  date: string; // ISO datetime
  amount: number; // sempre positivo; tipo CREDIT/DEBIT indica direção
  amountInAccountCurrency?: number | null;
  currencyCode: string;
  type: "CREDIT" | "DEBIT";
  status: "POSTED" | "PENDING";
  category?: string | null;
  categoryId?: string | null;
  balance?: number | null;
  paymentData?: PluggyPaymentData | null;
  creditCardMetadata?: PluggyCreditCardMetadata | null;
  merchant?: PluggyMerchant | null;
}

export interface PluggyPagedResult<T> {
  results: T[];
  page: number;
  total: number;
  totalPages: number;
}

export interface PluggyConnectTokenResponse {
  accessToken: string;
}

export interface PluggyAuthResponse {
  apiKey: string;
}
