/**
 * Tipos Gmail API (subset que usamos).
 * Doc: https://developers.google.com/gmail/api/reference/rest/v1/users.messages
 */

export interface GmailOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: "Bearer";
  id_token?: string;
}

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

export interface GmailListMessagesResponse {
  messages?: GmailMessageRef[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailHeader[];
  body: {
    attachmentId?: string;
    size: number;
    data?: string; // base64url-encoded
  };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailPart;
  sizeEstimate?: number;
}

export interface GmailAttachment {
  size: number;
  data: string; // base64url-encoded
}

export interface GmailUserProfile {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}
