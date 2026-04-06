export interface Comment {
  id: string;
  postUrl: string;
  postContent: string;
  authorName: string;
  authorProfileUrl: string;
  content: string;
  timestamp: string;
  alreadyReplied: boolean;
}

export interface Reply {
  commentId: string;
  originalComment: string;
  generatedContent: string;
  status: 'pending' | 'approved' | 'modified' | 'rejected' | 'sent' | 'failed';
  finalContent: string;
}

export interface DirectMessage {
  commentId: string;
  recipientName: string;
  recipientProfileUrl: string;
  generatedContent: string;
  status: 'pending' | 'approved' | 'modified' | 'rejected' | 'sent' | 'failed';
  finalContent: string;
}

export interface AppConfig {
  loginMethod: 'google' | 'direct';
  linkedinEmail: string;
  linkedinPassword: string;
  googleEmail: string;
  googlePassword: string;
  promoText: string;
  dataDir: string;
}
