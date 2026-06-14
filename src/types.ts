export interface PdfDocument {
  id: string; // Dynamic slug/document id
  title: string;
  description: string; // Markdown supported
  fileSize: string; // e.g., "14.2 MB"
  pageCount: number; // e.g., 42
  category: string; // e.g. "Syllabus", "Exam Prep", "Government Forms", "E-Books"
  tags: string[];
  thirdPartyViewUrl: string; // Google Drive viewing link, etc.
  thirdPartyDownloadUrl: string; // Google Drive download link, etc.
  coverUrl?: string; // High quality custom cover banner image URL
  clickCount: number;
  downloadCount: number;
  createdBy: string; // Admin UID
  creatorEmail: string; // Creator account email
  createdAt: any; // Firestore Timestamp
  membersOnly?: boolean; // Premium login restriction
}

export interface AdminPermissions {
  isSuperAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageAdmins: boolean;
}

export interface AdminUser {
  id: string; // doc ID (usually email in lowercase)
  email: string;
  role: 'full' | 'edit_delete' | 'edit_only';
  canEdit: boolean;
  canDelete: boolean;
  canManageAdmins: boolean;
  addedBy: string;
  addedAt: string;
}

export interface SystemStats {
  totalPdfs: number;
  totalClicks: number;
  totalDownloads: number;
  categoryDistribution: { [key: string]: number };
}

export interface Category {
  id: string;
  name: string;
  addedBy?: string;
  addedAt?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  content: string; // markdown supported
  coverUrl?: string;
  author: string;
  authorEmail: string;
  createdAt: any;
  readTime: string;
}

