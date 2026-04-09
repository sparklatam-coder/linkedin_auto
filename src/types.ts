export interface Contact {
  id: string;
  postUrl: string;
  postContent: string;
  authorName: string;
  authorProfileUrl: string;
  commentContent: string;
  commentTimestamp: string;
  isConnected: boolean | null; // null=미확인, true=1촌, false=아님
  liked: boolean;
  reply: {
    status: 'pending' | 'approved' | 'sent' | 'skipped';
    content: string;
  };
  dm: {
    status: 'pending' | 'approved' | 'sent' | 'failed' | 'not-connected';
    content: string;
  };
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
