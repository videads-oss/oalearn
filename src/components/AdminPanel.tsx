import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, LayoutDashboard, FilePlus, Sparkles, 
  HelpCircle, CheckCircle2, TrendingUp, Download, Eye, 
  Search, Link2, FileText, ArrowRight, FolderKanban, Info,
  AlertTriangle, RefreshCw, FolderPlus, X, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { PdfDocument, AdminPermissions, AdminUser, Category } from '../types';
import { translations, Language } from '../lib/translations';
import { INITIAL_FALLBACK_PDFS } from '../lib/mockData';

interface AdminPanelProps {
  userEmail: string;
  lang: Language;
  permissions: AdminPermissions;
}

export default function AdminPanel({ userEmail, lang, permissions }: AdminPanelProps) {
  const t = translations[lang];

  // Mode configuration
  const [activeTab, setActiveTab] = useState<'manage' | 'editor' | 'admins' | 'categories'>('manage');
  const [editingPdf, setEditingPdf] = useState<PdfDocument | null>(null);

  // Administrative team management states
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminCanEdit, setNewAdminCanEdit] = useState(true);
  const [newAdminCanDelete, setNewAdminCanDelete] = useState(false);
  const [newAdminCanManageAdmins, setNewAdminCanManageAdmins] = useState(false);

  // Dynamic categories management state
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  // Data storage
  const [pdfs, setPdfs] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [formId, setFormId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFileSize, setFormFileSize] = useState('1.5 MB');
  const [formPageCount, setFormPageCount] = useState<number>(1);
  const [formCategory, setFormCategory] = useState('Study Notes');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formMembersOnly, setFormMembersOnly] = useState(false);
  const [formThirdPartyViewUrl, setFormThirdPartyViewUrl] = useState('');
  const [formThirdPartyDownloadUrl, setFormThirdPartyDownloadUrl] = useState('');
  const [formCoverUrl, setFormCoverUrl] = useState('');

  // Dynamic Categories list with fallback defaults
  const categories = dbCategories.length > 0 
    ? dbCategories.map(c => c.name) 
    : [
        'Study Notes',
        'Previous Year Papers',
        'Syllabus & Curriculum',
        'Exam Series',
        'E-Books & Competitions',
        'General Information'
      ];

  // Fetch PDFs from Firestore
  const fetchAllDocs = async () => {
    setLoading(true);
    setErrorMessage(null);
    
    const loadFallbackCatalog = () => {
      const cached = localStorage.getItem('officers_academy_fallback_pdfs');
      if (cached) {
        try {
          setPdfs(JSON.parse(cached));
        } catch {
          setPdfs(INITIAL_FALLBACK_PDFS);
        }
      } else {
        setPdfs(INITIAL_FALLBACK_PDFS);
      }
    };

    try {
      const q = query(collection(db, 'pdfs'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const docsList: PdfDocument[] = [];
      querySnapshot.forEach((document) => {
        docsList.push({ id: document.id, ...document.data() } as PdfDocument);
      });
      
      if (docsList.length === 0) {
        loadFallbackCatalog();
      } else {
        setPdfs(docsList);
        localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(docsList));
      }
    } catch (error) {
      console.error("Failed to load PDF indices from Firebase: ", error);
      
      // Standardize reporting
      try {
        handleFirestoreError(error, OperationType.LIST, 'pdfs');
      } catch (logError) {
        console.error("Firestore Error Details: ", (logError as Error).message);
      }
      
      loadFallbackCatalog();
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    if (!permissions.canManageAdmins) return;
    setAdminsLoading(true);
    try {
      const q = query(collection(db, 'admins'));
      const querySnapshot = await getDocs(q);
      const list: AdminUser[] = [];
      querySnapshot.forEach((document) => {
        list.push({ id: document.id, ...document.data() } as AdminUser);
      });
      setAdmins(list);
    } catch (error) {
      console.error("Error loading admin users catalog: ", error);
    } finally {
      setAdminsLoading(false);
    }
  };

  const fetchCategoriesList = async () => {
    setCategoriesLoading(true);
    try {
      const q = query(collection(db, 'categories'));
      const querySnapshot = await getDocs(q);
      const list: Category[] = [];
      querySnapshot.forEach((document) => {
        list.push({ id: document.id, ...document.data() } as Category);
      });
      
      if (list.length === 0) {
        // If it's empty, and the user has edit permission, let's auto-seed default categories
        if (permissions.canEdit) {
          const defaults = [
            'Study Notes',
            'Previous Year Papers',
            'Syllabus & Curriculum',
            'Exam Series',
            'E-Books & Competitions',
            'General Information'
          ];
          const seeded: Category[] = [];
          try {
            for (const name of defaults) {
              const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              const docRef = doc(db, 'categories', slug);
              const catObj = {
                id: slug,
                name: name,
                addedBy: userEmail,
                addedAt: new Date().toISOString()
              };
              await setDoc(docRef, catObj);
              seeded.push(catObj);
            }
            setDbCategories(seeded);
          } catch (writeErr) {
            console.warn("Auto-seeding categories failed, falling back to static defaults: ", writeErr);
            // Fallback if they can't write: present static defaults as simulated dynamic list
            setDbCategories(defaults.map((name, index) => ({
              id: `seed-${index}`,
              name,
              addedBy: 'System',
              addedAt: new Date().toISOString()
            })));
          }
        } else {
          // Fallback if they can't write
          const defaults = [
            'Study Notes',
            'Previous Year Papers',
            'Syllabus & Curriculum',
            'Exam Series',
            'E-Books & Competitions',
            'General Information'
          ];
          setDbCategories(defaults.map((name, index) => ({
            id: `seed-${index}`,
            name,
            addedBy: 'System',
            addedAt: new Date().toISOString()
          })));
        }
      } else {
        setDbCategories(list);
      }
    } catch (error) {
      console.error("Error fetching dynamic categories: ", error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canEdit) {
      setErrorMessage(lang === 'hi' ? "आपके पास संपादन की अनुमति नहीं है।" : "You do not have required edit permissions.");
      return;
    }
    const name = newCategoryName.trim();
    if (!name) {
      setErrorMessage(lang === 'hi' ? "कृपया एक मान्य श्रेणी नाम दर्ज करें।" : "Please specify a valid category name.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const docRef = doc(db, 'categories', slug);
    const payload: Category = {
      id: slug,
      name: name,
      addedBy: userEmail,
      addedAt: new Date().toISOString()
    };

    try {
      await setDoc(docRef, payload);
      setSuccessMessage(lang === 'hi' ? `श्रेणी "${name}" सफलतापूर्वक जोड़ी गई!` : `Category "${name}" created successfully!`);
      setNewCategoryName('');
      fetchCategoriesList();
    } catch (err) {
      console.error("Failed to add category: ", err);
      setErrorMessage(lang === 'hi' ? "श्रेणी सहेजने में विफल।" : "Failed to record category. Check permissions.");
    }
  };

  const handleUpdateCategoryName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    if (!permissions.canEdit) {
      setErrorMessage(lang === 'hi' ? "आपके पास संपादन की अनुमति नहीं है।" : "You do not have required edit permissions.");
      return;
    }
    const newName = editCategoryName.trim();
    if (!newName) {
      setErrorMessage(lang === 'hi' ? "नाम खाली नहीं हो सकता।" : "Category name cannot be empty.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const docRef = doc(db, 'categories', editingCategory.id);
    try {
      await setDoc(docRef, {
        ...editingCategory,
        name: newName
      });
      setSuccessMessage(lang === 'hi' ? "श्रेणी अद्यतन सफल!" : "Category renamed successfully!");
      setEditingCategory(null);
      setEditCategoryName('');
      fetchCategoriesList();
    } catch (err) {
      console.error("Failed to rename category: ", err);
      setErrorMessage(lang === 'hi' ? "श्रेणी अद्यतन में विफल।" : "Failed to rename category. Try again.");
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!permissions.canDelete) {
      setErrorMessage(lang === 'hi' ? "आपके पास हटाने की अनुमति नहीं है।" : "You do not have delete authority.");
      return;
    }
    if (!window.confirm(lang === 'hi' ? `क्या आप सचमुच "${categoryName}" श्रेणी को हटाना चाहते हैं?` : `Are you sure you want to delete "${categoryName}" category?`)) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteDoc(doc(db, 'categories', categoryId));
      setSuccessMessage(lang === 'hi' ? "श्रेणी हटाई गई।" : "Category discarded successfully.");
      fetchCategoriesList();
    } catch (err) {
      console.error("Failed clear category: ", err);
      setErrorMessage(lang === 'hi' ? "श्रेणी हटाने में विफल।" : "Could not remove specified category.");
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canManageAdmins) {
      setErrorMessage(lang === 'hi'
        ? "आपके पास अन्य प्रबंधकों को प्रबंधित करने का अधिकार नहीं है।"
        : "You do not have permission to manage other administrative settings."
      );
      return;
    }

    const targetEmail = newAdminEmail.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMessage(lang === 'hi' ? "कृपया एक मान्य ईमेल दर्ज करें।" : "Please provide a valid email address.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const docId = targetEmail;
    const adminDocRef = doc(db, 'admins', docId);

    const payload: Omit<AdminUser, 'id'> = {
      email: targetEmail,
      role: newAdminCanManageAdmins ? 'full' : (newAdminCanDelete ? 'edit_delete' : 'edit_only'),
      canEdit: newAdminCanEdit,
      canDelete: newAdminCanDelete,
      canManageAdmins: newAdminCanManageAdmins,
      addedBy: userEmail,
      addedAt: new Date().toISOString()
    };

    try {
      await setDoc(adminDocRef, payload);
      setSuccessMessage(lang === 'hi'
        ? `नया प्रबंधक ${targetEmail} सफलतापूर्वक जोड़ा गया!`
        : `Administrator ${targetEmail} updated with designated roles successfully!`
      );
      setNewAdminEmail('');
      setNewAdminCanEdit(true);
      setNewAdminCanDelete(false);
      setNewAdminCanManageAdmins(false);
      fetchAdminUsers();
    } catch (err) {
      console.error("Failed to persist authority: ", err);
      setErrorMessage(lang === 'hi'
        ? "प्रबंधक को सहेजने में विफल। नियम प्रतिबंधों की जाँच करें।"
        : "Failed to allocate roles to user. Check security rules or try again."
      );
    }
  };

  const handleDeleteAdmin = async (emailToDelete: string) => {
    if (!permissions.canManageAdmins) {
      setErrorMessage(lang === 'hi'
        ? "आपके पास प्रबंधकों को प्रबंधित करने की अनुमति नहीं है।"
        : "You do not have permissions to manage administrative roles."
      );
      return;
    }

    const isConfirmed = window.confirm(lang === 'hi'
      ? `क्या आप वाकई ${emailToDelete} के प्रबंधन विशेषाधिकारों को रद्द करना चाहते हैं?`
      : `Are you sure you want to permanently revoke administrative authorization for ${emailToDelete}?`
    );

    if (!isConfirmed) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteDoc(doc(db, 'admins', emailToDelete.toLowerCase()));
      setSuccessMessage(lang === 'hi'
        ? `${emailToDelete} के विशेषाधिकार सफलतापूर्वक वापस ले लिए गए हैं!`
        : `Admin authority for ${emailToDelete} revoked successfully!`
      );
      fetchAdminUsers();
    } catch (err) {
      console.error("Failed to delete admin: ", err);
      setErrorMessage(lang === 'hi'
        ? "संबद्ध अधिकार रद्द करने में विफल।"
        : "Failed to delete administrative authority from database."
      );
    }
  };

  useEffect(() => {
    fetchAllDocs();
    fetchCategoriesList();
    if (permissions.canManageAdmins) {
      fetchAdminUsers();
    }
  }, [permissions.canManageAdmins]);

  // Set values to form for Editing
  const startEditFlow = (pdf: PdfDocument) => {
    setEditingPdf(pdf);
    setFormId(pdf.id);
    setFormTitle(pdf.title);
    setFormDescription(pdf.description);
    setFormFileSize(pdf.fileSize);
    setFormPageCount(pdf.pageCount);
    
    // Check if category is standard
    if (categories.includes(pdf.category)) {
      setFormCategory(pdf.category);
      setFormCustomCategory('');
    } else {
      setFormCategory('Other (Type Custom Category Below)');
      setFormCustomCategory(pdf.category);
    }
    
    setFormMembersOnly(!!pdf.membersOnly);
    setFormThirdPartyViewUrl(pdf.thirdPartyViewUrl);
    setFormThirdPartyDownloadUrl(pdf.thirdPartyDownloadUrl);
    setFormCoverUrl(pdf.coverUrl || '');
    
    setErrorMessage(null);
    setSuccessMessage(null);
    setActiveTab('editor');
  };

  // Turn Title into dynamic clean URL Slug
  const autoGenerateSlug = () => {
    if (!formTitle) return;
    const cleanSlug = formTitle
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '') // remove symbols
      .trim()
      .replace(/\s+/g, '-') // replace spaces
      .substring(0, 50); // limit length
    setFormId(cleanSlug);
  };

  // Submit Add or Edit Form
  const triggerSaveCollectionEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!permissions.canEdit) {
      setErrorMessage(lang === 'hi'
        ? "त्रुटि: आपके पास सूची में अध्ययन सामग्री को जोड़ने या संपादित करने की अनुमति नहीं है।"
        : "Unauthorized: You do not have permission to add or edit study resources in this catalog."
      );
      return;
    }

    // Validate inputs
    if (!formId || !formTitle || !formThirdPartyViewUrl || !formThirdPartyDownloadUrl) {
      setErrorMessage(lang === 'hi'
        ? "कृपया सभी आवश्यक स्टार (*) वाले क्षेत्रों को भरें।"
        : "Please review custom slug, document title, and third party resource URLs."
      );
      return;
    }

    // Determine final category string
    const finalCategory = formCategory === 'Other (Type Custom Category Below)'
      ? (formCustomCategory ? formCustomCategory.trim() : 'General')
      : formCategory;

    let targetDocId = formId;
    if (!editingPdf) {
      targetDocId = formTitle
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '') // remove symbols
        .trim()
        .replace(/\s+/g, '-') // replace spaces
        .substring(0, 50); // limit length
      if (!targetDocId) {
        targetDocId = 'doc-' + Math.random().toString(36).substring(2, 9);
      }
    }

    const docRef = doc(db, 'pdfs', targetDocId);
    
    try {
      const payload: Partial<PdfDocument & { membersOnly?: boolean }> = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        fileSize: formFileSize.trim(),
        pageCount: Number(formPageCount),
        category: finalCategory,
        tags: [],
        membersOnly: formMembersOnly,
        thirdPartyViewUrl: formThirdPartyViewUrl.trim(),
        thirdPartyDownloadUrl: formThirdPartyDownloadUrl.trim(),
        coverUrl: formCoverUrl.trim() || undefined
      };

      if (!editingPdf) {
        // Init stats
        payload.clickCount = 0;
        payload.downloadCount = 0;
        payload.createdBy = 'google_admin';
        payload.creatorEmail = userEmail;
        payload.createdAt = new Date().toISOString();
      }

      const mergedPayload = { id: targetDocId, ...payload } as PdfDocument;

      try {
        await setDoc(docRef, payload, { merge: true });
        
        // Sync locally
        const cached = localStorage.getItem('officers_academy_fallback_pdfs');
        let currentList: PdfDocument[] = cached ? JSON.parse(cached) : [];
        if (!Array.isArray(currentList)) currentList = [];
        const index = currentList.findIndex(p => p.id === targetDocId);
        if (index !== -1) {
          currentList[index] = mergedPayload;
        } else {
          currentList.unshift(mergedPayload);
        }
        localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(currentList));

        setSuccessMessage(
          editingPdf 
            ? (lang === 'hi' ? "सफलतापूर्वक अपडेट किया गया!" : "Study material index updated successfully!")
            : (lang === 'hi' ? "नई पीडीएफ अध्ययन जानकारी सफलतापूर्वक इंडेक्स की गई!" : "New PDF resource indexed successfully!")
        );

        resetForm();
        fetchAllDocs();
        setActiveTab('manage');
      } catch (dbErr) {
        console.warn("DB write failed, falling back to LocalStorage sandbox: ", dbErr);
        
        // Diagnostics print
        try {
          handleFirestoreError(dbErr, editingPdf ? OperationType.UPDATE : OperationType.CREATE, `pdfs/${targetDocId}`);
        } catch (logError) {
          console.error("Firestore Error Details: ", (logError as Error).message);
        }

        const cached = localStorage.getItem('officers_academy_fallback_pdfs');
        let currentList: PdfDocument[] = cached ? JSON.parse(cached) : [];
        if (!Array.isArray(currentList)) currentList = [];
        const index = currentList.findIndex(p => p.id === targetDocId);
        if (index !== -1) {
          currentList[index] = mergedPayload;
        } else {
          currentList.unshift(mergedPayload);
        }
        localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(currentList));

        setSuccessMessage(
          editingPdf 
            ? (lang === 'hi' ? "सफलतापूर्वक अपडेट किया गया (सैंडबॉक्स मोड)!" : "Study material index updated successfully (Sandbox Mode)!")
            : (lang === 'hi' ? "नई पीडीएफ अध्ययन जानकारी सफलतापूर्वक इंडेक्स की गई (सैंडबॉक्स मोड)!" : "New PDF resource indexed successfully (Sandbox Mode)!")
        );

        resetForm();
        setPdfs(currentList);
        setActiveTab('manage');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(lang === 'hi'
        ? "राइट अनुमति अस्वीकृत की गई। सत्यापन स्थिति जांचें।"
        : "Write permission rejected. Verify your administrator authentication status."
      );
    }
  };

  const triggerDelete = async (pdfId: string) => {
    if (!permissions.canDelete) {
      setErrorMessage(lang === 'hi'
        ? "त्रुटि: आपके पास इस दस्तावेज़ को हटाने के लिए प्रशासनिक विशेषाधिकार नहीं हैं।"
        : "Unauthorized: You do not have administrative privileges to delete study materials."
      );
      return;
    }

    const isConfirmed = window.confirm(lang === 'hi' 
      ? `क्या आप वाकई अध्ययन दस्तावेज '#${pdfId}' को सूची से स्थायी रूप से हटाना चाहते हैं?` 
      : `Are you sure you want to permanently delete high-speed study document #${pdfId}?`
    );

    if (!isConfirmed) {
      return;
    }

    try {
      try {
        await deleteDoc(doc(db, 'pdfs', pdfId));
        setSuccessMessage(lang === 'hi' 
          ? "दस्तावेज़ सफलतापूर्वक सूची से हटा दिया गया!" 
          : "Resource reference deleted successfully!"
        );
        
        const cached = localStorage.getItem('officers_academy_fallback_pdfs');
        let currentList: PdfDocument[] = cached ? JSON.parse(cached) : [];
        currentList = currentList.filter(p => p.id !== pdfId);
        localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(currentList));
        fetchAllDocs();
      } catch (dbErr) {
        console.warn("DB delete failed, falling back to LocalStorage sandbox: ", dbErr);
        
        try {
          handleFirestoreError(dbErr, OperationType.DELETE, `pdfs/${pdfId}`);
        } catch (logError) {
          console.error("Firestore Error Details: ", (logError as Error).message);
        }

        const cached = localStorage.getItem('officers_academy_fallback_pdfs');
        let currentList: PdfDocument[] = cached ? JSON.parse(cached) : [];
        currentList = currentList.filter(p => p.id !== pdfId);
        localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(currentList));

        setSuccessMessage(lang === 'hi' 
          ? "दस्तावेज़ सफलतापूर्वक सूची से हटा दिया गया (सैंडबॉक्स मोड)!" 
          : "Resource reference deleted successfully (Sandbox Mode)!"
        );
        setPdfs(currentList);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Delete reference rejected. Check Firestore permissions.");
    }
  };

  const resetForm = () => {
    setEditingPdf(null);
    setFormId('');
    setFormTitle('');
    setFormDescription('');
    setFormFileSize('1.5 MB');
    setFormPageCount(1);
    setFormCategory('Study Notes');
    setFormCustomCategory('');
    setFormMembersOnly(false);
    setFormThirdPartyViewUrl('');
    setFormThirdPartyDownloadUrl('');
    setFormCoverUrl('');
  };

  // Calculate stats for widgets
  const totalUploadsCount = pdfs.length;
  const totalViewsAccumulated = pdfs.reduce((acc, curr) => acc + (curr.clickCount || 0), 0);
  const totalDownloadsAccumulated = pdfs.reduce((acc, curr) => acc + (curr.downloadCount || 0), 0);

  // Filter items based on administrative search query
  const filteredPdfs = pdfs.filter(pdf => 
    pdf.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    pdf.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pdf.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 text-slate-800 antialiased font-sans">
      
      {/* Welcome Title */}
      <div className="bg-slate-55/40 backdrop-blur-md rounded-3xl p-5 mb-6 border border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center space-x-2">
            <LayoutDashboard className="h-5.5 w-5.5 text-indigo-500" />
            <span>{t.welcomeAdmin}</span>
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            {t.restrictedAdmin} <span className="bg-indigo-50 px-2 py-0.5 rounded-full font-bold text-indigo-700">{userEmail}</span>
          </p>
        </div>

        {/* Tab triggers in robust sketch style */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl gap-1">
          <button
            onClick={() => {
              setActiveTab('manage');
              resetForm();
            }}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex items-center space-x-1.5 ${
              activeTab === 'manage'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            <span>{t.manageBtn}</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setActiveTab('editor');
            }}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex items-center space-x-1.5 ${
              activeTab === 'editor' && !editingPdf
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.addBtn}</span>
          </button>
          
          <button
            onClick={() => {
              resetForm();
              setActiveTab('categories');
            }}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex items-center space-x-1.5 ${
              activeTab === 'categories'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>{lang === 'hi' ? 'श्रेणियां' : 'Categories'}</span>
          </button>
          
          {permissions.canManageAdmins && (
            <button
              onClick={() => {
                resetForm();
                setActiveTab('admins');
              }}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex items-center space-x-1.5 ${
                activeTab === 'admins'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{lang === 'hi' ? 'भूमिकाएं' : 'Admin Roles'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner messages */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 flex items-center justify-between text-emerald-800 text-xs font-semibold animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-6 flex items-center justify-between text-rose-800 text-xs font-semibold animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 rounded text-rose-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activeTab === 'manage' ? (
        <>
          {/* Quick Metrics Widget Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-3xl p-5 flex items-center space-x-4 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sans">{t.totalUploads}</span>
                <span className="text-xl font-bold text-slate-800 font-monoLeading">{totalUploadsCount}</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 flex items-center space-x-4 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <div className="bg-violet-50 p-3 rounded-2xl text-violet-600">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sans">{t.totalClicks}</span>
                <span className="text-xl font-bold text-slate-800 font-monoLeading">{totalViewsAccumulated}</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 flex items-center space-x-4 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sans">{t.accumulatedDownloads}</span>
                <span className="text-xl font-bold text-slate-800 font-monoLeading">{totalDownloadsAccumulated}</span>
              </div>
            </div>
          </div>

          {/* Search Table Block */}
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-12">
            
            {/* Table Search filter */}
            <div className="p-5 border-b border-slate-50 bg-slate-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-sans">
                📖 {t.docDirectory}
              </h3>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.searchPlaceholder.split(',')[0]}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-100/60 placeholder-slate-400 text-slate-800 text-xs font-semibold pl-9 pr-3 py-2 rounded-2xl border border-transparent outline-none focus:border-indigo-100 focus:bg-white"
                />
              </div>
            </div>

            {/* List Loader */}
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12">
                <RefreshCw className="h-6 w-6 text-slate-800 animate-spin mb-3 stroke-[2.5]" />
                <span className="text-xs text-slate-650 font-bold font-sans">Updating database inventory...</span>
              </div>
            ) : filteredPdfs.length === 0 ? (
              <div className="text-center p-12 text-slate-500 bg-white">
                <Info className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                <p className="text-xs font-bold mb-1">{t.noPdfs}</p>
                <p className="text-[10px] text-slate-550 font-sans font-semibold">Try creating some records first.</p>
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-900 text-[10px] font-bold text-slate-500 select-none uppercase font-sans">
                        <th className="p-4 tracking-wider">{t.pdfTitle}</th>
                        <th className="p-4 tracking-wider">{t.customId}</th>
                        <th className="p-4 tracking-wider text-center">{t.views}</th>
                        <th className="p-4 tracking-wider text-center">{t.downloads}</th>
                        <th className="p-4 tracking-wider text-right">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans bg-white text-xs font-semibold">
                      {filteredPdfs.map((pdf) => (
                        <tr key={pdf.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 max-w-[320px]">
                            <div className="flex items-center space-x-3.5">
                              <div className="bg-amber-100 text-amber-950 p-2.5 rounded-xl border border-slate-800 flex-shrink-0">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="truncate">
                                <span className="block text-xs font-black text-slate-900 truncate leading-tight mb-1.5">{pdf.title}</span>
                                <span className="inline-block text-[9px] font-bold bg-[#FCFAF2] border border-slate-400 text-slate-800 px-2 py-0.5 rounded uppercase font-mono">
                                  {pdf.category}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="bg-slate-100 border border-slate-250 rounded-lg px-2 py-0.5 text-slate-600 font-mono text-[11px] font-semibold" title={pdf.id}>
                              #{pdf.id}
                            </span>
                          </td>
                          <td className="p-4 text-center font-mono font-black text-slate-800">
                            {pdf.clickCount || 0}
                          </td>
                          <td className="p-4 text-center font-mono font-black text-slate-800">
                            {pdf.downloadCount || 0}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {/* Open Landing Page preview */}
                              <a 
                                href={`/pdf/${pdf.id}`}
                                className="p-2 border-2 border-slate-900 bg-white hover:bg-slate-50 rounded-xl text-slate-800 hover:text-indigo-600 shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5 transition cursor-pointer"
                                title="View landing page"
                              >
                                <Link2 className="h-4 w-4 stroke-[2.2]" />
                              </a>
                              <button
                                onClick={() => startEditFlow(pdf)}
                                className="p-2 border-2 border-slate-900 bg-white hover:bg-slate-50 rounded-xl text-slate-800 hover:text-amber-600 shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5 transition cursor-pointer"
                                title="Edit/Modify"
                              >
                                <Edit className="h-4 w-4 stroke-[2.2]" />
                              </button>
                              <button
                                onClick={() => triggerDelete(pdf.id)}
                                className="p-2 border-2 border-slate-900 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-800 hover:text-rose-955 shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5 transition cursor-pointer"
                                title="Delete document reference"
                              >
                                <Trash2 className="h-4 w-4 stroke-[2.2]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Document Cards */}
                <div className="block md:hidden divide-y divide-slate-200 bg-white">
                  {filteredPdfs.map((pdf) => (
                    <div key={pdf.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block text-[8.5px] font-mono font-extrabold bg-[#FCFAF2] border border-slate-400 text-slate-700 px-2 py-0.5 rounded mb-1.5 uppercase tracking-wide">
                            {pdf.category}
                          </span>
                          <h4 className="text-xs font-black text-slate-900 leading-snug uppercase">
                            {pdf.title}
                          </h4>
                          <span className="inline-block text-[10px] font-mono font-semibold text-slate-500 mt-1">
                            ID Slug: #{pdf.id}
                          </span>
                        </div>
                        <div className="bg-amber-100 text-amber-950 p-2.5 rounded-xl border-2 border-slate-900 flex-shrink-0 shadow-[2px_2px_0px_#000]">
                          <FileText className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Display View/Download Counts as clean responsive indicators */}
                      <div className="grid grid-cols-2 gap-2 bg-[#FCFAF2] border-2 border-slate-900 p-2.5 rounded-xl text-center select-none font-mono">
                        <div className="text-[10px] font-bold text-slate-600 flex items-center justify-center space-x-1.5">
                          <Eye className="h-3.5 w-3.5 text-amber-600 stroke-[2.2]" />
                          <span>Views: <strong className="text-slate-900">{pdf.clickCount || 0}</strong></span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-600 flex items-center justify-center space-x-1.5 border-l border-slate-350">
                          <Download className="h-3.5 w-3.5 text-emerald-600 stroke-[2.2]" />
                          <span>Downloads: <strong className="text-[#10b981]">{pdf.downloadCount || 0}</strong></span>
                        </div>
                      </div>

                      {/* Explicit clean action buttons with proper spacing */}
                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <a 
                          href={`/pdf/${pdf.id}`}
                          className="flex items-center justify-center space-x-1 px-3 py-2 border-2 border-slate-900 bg-white hover:bg-slate-50 rounded-xl text-[10px] font-sketch font-bold text-slate-800 shadow-[2px_2px_0px_#000]"
                        >
                          <Link2 className="h-3.5 w-3.5 stroke-[2.2]" />
                          <span>View Page</span>
                        </a>
                        <button
                          onClick={() => startEditFlow(pdf)}
                          className="flex items-center justify-center space-x-1 px-3 py-2 border-2 border-slate-900 bg-white hover:bg-slate-50 rounded-xl text-[10px] font-sketch font-bold text-slate-800 shadow-[2px_2px_0px_#000]"
                        >
                          <Edit className="h-3.5 w-3.5 stroke-[2.2]" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => triggerDelete(pdf.id)}
                          className="flex items-center justify-center space-x-1 px-3 py-2 border-2 border-slate-900 bg-rose-50 hover:bg-rose-100 rounded-xl text-[10px] font-sketch font-extrabold text-rose-800 shadow-[2px_2px_0px_#000]"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-700 stroke-[2.2]" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      ) : activeTab === 'categories' ? (
        /* Dynamic Category Management Panel */
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-8 max-w-4xl mx-auto shadow-[6px_6px_0px_#0f172a] relative overflow-hidden mb-12 animate-fade-in bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:16px_16px]">
          <div className="border-b-2 border-slate-900 border-dashed pb-5 mb-6">
            <h3 className="text-base sm:text-lg font-sketch font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
              <FolderPlus className="h-5.5 w-5.5 text-indigo-600 stroke-[2.2]" />
              <span className="uppercase">{lang === 'hi' ? 'श्रेणी सूची व प्रबंधन' : 'Category Management'}</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5">
              {lang === 'hi' 
                ? 'नयी शिक्षण श्रेणियों को जोड़े, सुधारे या हटाए। परिवर्तन तुरंत उपयोगकर्ता की होम स्क्रीन पर प्रतिबिंबित होंगे।'
                : 'Create, modify, and delete document organization categories. Updates are instantly updated on the home portal catalogs.'}
            </p>
          </div>

          {/* Create Category Form */}
          {!editingCategory ? (
            <form onSubmit={handleAddCategory} className="space-y-4 mb-8 bg-slate-50 border-2 border-slate-900 p-5 rounded-2xl">
              <h4 className="text-xs font-sketch font-bold uppercase tracking-wider text-slate-800">
                {lang === 'hi' ? 'नयी श्रेणी जोड़ें' : 'Create New Category'}
              </h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  placeholder={lang === 'hi' ? "उदा: सामान्य ज्ञान" : "e.g. Current Affairs"}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="bg-white border-2 border-slate-900 text-slate-800 text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200 flex-grow"
                />
                <button
                  type="submit"
                  disabled={!permissions.canEdit}
                  className="bg-[#A3E635] hover:bg-[#bbf054] text-slate-950 font-sketch font-extrabold py-3.5 px-6 rounded-xl border-2 border-slate-900 transition duration-200 flex items-center justify-center space-x-2 cursor-pointer text-xs uppercase shadow-[2px_2px_0px_#000] active:translate-y-0.5 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>{lang === 'hi' ? 'श्रेणी जोड़ें' : 'Add Category'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleUpdateCategoryName} className="space-y-4 mb-8 bg-amber-50/50 border-2 border-slate-900 p-5 rounded-2xl animate-fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-sketch font-bold uppercase tracking-wider text-slate-800">
                  {lang === 'hi' ? 'श्रेणी नाम बदलें' : 'Rename Category'}
                </h4>
                <button 
                  type="button" 
                  onClick={() => { setEditingCategory(null); setEditCategoryName(''); }}
                  className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  placeholder={lang === 'hi' ? "श्रेणी का नया नाम दर्ज करें" : "Enter new category name"}
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="bg-white border-2 border-slate-900 text-slate-800 text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200 flex-grow"
                />
                <button
                  type="submit"
                  disabled={!permissions.canEdit}
                  className="bg-[#FFE600] hover:bg-[#FFF275] text-slate-950 font-sketch font-extrabold py-3.5 px-6 rounded-xl border-2 border-slate-900 transition duration-200 flex items-center justify-center space-x-2 cursor-pointer text-xs uppercase shadow-[2px_2px_0px_#000] active:translate-y-0.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                  <span>{lang === 'hi' ? 'अपडेट श्रेणी' : 'Update Name'}</span>
                </button>
              </div>
            </form>
          )}

          {/* List of Categories in Firestore */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
            <h4 className="text-xs font-sketch font-bold uppercase tracking-wider text-slate-800 mb-4 pb-2 border-b border-slate-200">
              {lang === 'hi' ? 'वर्तमान में सक्रिय श्रेणियां' : 'All Configured Categories'}
            </h4>

            {categoriesLoading ? (
              <div className="flex space-x-2 text-xs font-semibold text-slate-500 py-6 justify-center items-center">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                <span>Loading category collections...</span>
              </div>
            ) : dbCategories.length === 0 ? (
              <p className="text-xs font-semibold text-slate-400 py-6 text-center font-sans font-bold">No categories found in system database registry.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {dbCategories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-xs sm:text-sm font-sans font-bold text-slate-900">{cat.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID: <span className="font-bold">{cat.id}</span>
                        {cat.addedAt && ` • Added: ${new Date(cat.addedAt).toLocaleDateString()}`}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setEditCategoryName(cat.name);
                        }}
                        disabled={!permissions.canEdit}
                        className="p-2 bg-white hover:bg-slate-50 text-indigo-700 hover:text-indigo-800 border-2 border-slate-900 rounded-lg transition shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5 cursor-pointer disabled:opacity-50"
                        title="Rename"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        disabled={!permissions.canDelete}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border-2 border-slate-900 rounded-lg transition shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5 cursor-pointer disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'admins' ? (
        /* Admin Delegation Interface - STYLED IN ULTRAPREMIUM CHIC MINIMAL RETRO WEB STYLE */
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-8 max-w-4xl mx-auto shadow-[6px_6px_0px_#0f172a] relative overflow-hidden mb-12 animate-fade-in bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:16px_16px]">
          <div className="border-b-2 border-slate-900 border-dashed pb-5 mb-6">
            <h3 className="text-base sm:text-lg font-sketch font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
              <ShieldCheck className="h-5.5 w-5.5 text-indigo-600 stroke-[2.2]" />
              <span className="uppercase">{lang === 'hi' ? 'प्रबंधक विशेषाधिकार पोर्टल' : 'Administrative Roles & Delegation'}</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5">
              {lang === 'hi' 
                ? 'उम्मीदवारों के ईमेल जोड़कर उन्हें सीमित प्रशासनिक अधिकार सौंपें (जैसे कि सुधार या अध्ययन फाइलें हटाना)।'
                : 'Grant specific administrative permissions to other users using their email address. Assign exact limit functions below.'}
            </p>
          </div>

          <form onSubmit={handleAddAdmin} className="space-y-4 mb-8 bg-slate-50 border-2 border-slate-900 p-5 rounded-2xl">
            <h4 className="text-xs font-sketch font-bold uppercase tracking-wider text-slate-800">
              {lang === 'hi' ? 'नया प्रबंधक जोड़ें / भूमिका बदलें' : 'Add New Admin / Grant Privileges'}
            </h4>
            
            <div>
              <label className="block text-[11px] font-sketch font-bold uppercase tracking-wide text-slate-700 mb-1.5">
                {lang === 'hi' ? 'उपयोगकर्ता ईमेल *' : 'Aspirant Email Address *'}
              </label>
              <input
                type="email"
                required
                placeholder="e.g. aspirant@gmail.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 text-slate-800 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-xl border-2 border-slate-900">
              <label className="flex items-center space-x-3 cursor-pointer p-1 rounded hover:bg-slate-55 select-none text-slate-800">
                <input
                  type="checkbox"
                  checked={newAdminCanEdit}
                  onChange={(e) => setNewAdminCanEdit(e.target.checked)}
                  className="h-5 w-5 rounded border-2 border-slate-900 text-[#FFE600] focus:ring-amber-200 cursor-pointer accent-[#FFE600]"
                />
                <div className="text-[11px]">
                  <span className="block font-sketch font-bold uppercase">{lang === 'hi' ? 'संपादित कर सकते हैं' : 'Can Edit'}</span>
                  <span className="block text-[9px] text-slate-500 leading-tight">{lang === 'hi' ? 'फाइलें जोड़ने/संपादित करने के लिए' : 'Create & edit PDFs'}</span>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer p-1 rounded hover:bg-slate-55 select-none text-slate-800">
                <input
                  type="checkbox"
                  checked={newAdminCanDelete}
                  onChange={(e) => setNewAdminCanDelete(e.target.checked)}
                  className="h-5 w-5 rounded border-2 border-slate-900 text-[#FFE600] focus:ring-amber-200 cursor-pointer accent-[#FFE600]"
                />
                <div className="text-[11px]">
                  <span className="block font-sketch font-bold uppercase">{lang === 'hi' ? 'हटा सकते हैं' : 'Can Delete'}</span>
                  <span className="block text-[9px] text-slate-500 leading-tight">{lang === 'hi' ? 'फाइलें स्थायी रूप से हटाने के लिए' : 'Permanently remove PDFs'}</span>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer p-1 rounded hover:bg-slate-55 select-none text-slate-800">
                <input
                  type="checkbox"
                  checked={newAdminCanManageAdmins}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNewAdminCanManageAdmins(checked);
                    if (checked) {
                      setNewAdminCanEdit(true);
                      setNewAdminCanDelete(true);
                    }
                  }}
                  className="h-5 w-5 rounded border-2 border-slate-900 text-[#FFE600] focus:ring-amber-200 cursor-pointer accent-[#FFE600]"
                />
                <div className="text-[11px]">
                  <span className="block font-sketch font-bold uppercase text-indigo-750">{lang === 'hi' ? 'पूर्ण प्रबंधक अधिकार' : 'Full Access'}</span>
                  <span className="block text-[9px] text-slate-500 leading-tight">{lang === 'hi' ? 'अन्य प्रबंधकों को नियंत्रित करें' : 'Manage other roles'}</span>
                </div>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-[#FFE600] border-2 border-slate-900 hover:bg-[#FFF275] text-slate-900 font-sketch font-black px-5 py-3 rounded-xl text-xs transition-all flex items-center space-x-2 shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>{lang === 'hi' ? 'विशेषाधिकार सुरक्षित करें' : 'Authorize Admin'}</span>
              </button>
            </div>
          </form>

          {/* Current Administrators List */}
          <div>
            <h4 className="text-xs font-sketch font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center space-x-1.5">
              <span>{lang === 'hi' ? 'अधिकृत प्रशासनिक सूची' : 'Current Authorized Admins'}</span>
              <span className="bg-indigo-100 text-indigo-800 text-[9px] px-2 py-0.5 rounded-full font-mono text-center">{admins.length}</span>
            </h4>

            {adminsLoading ? (
              <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300">
                <RefreshCw className="h-5 w-5 text-indigo-600 animate-spin mb-2" />
                <span className="text-[11px] text-slate-500 font-mono font-bold">Retrieving access registry...</span>
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-350 select-none">
                <p className="text-xs text-slate-500 font-bold leading-relaxed">
                  {lang === 'hi' 
                    ? 'कोई कस्टम प्रशासनिक भूमिकाएँ सूची में नहीं हैं। केवल डिफ़ॉल्ट सुपर-एडमिन अधिकृत हैं।' 
                    : 'No custom administrator credentials added yet. Super Admin standard overrides remain active.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {admins.map((adm) => (
                  <div key={adm.id} className="bg-white border-2 border-slate-900 p-4 rounded-xl flex items-center justify-between shadow-[2.5px_2.5px_0px_#0f172a] hover:shadow-[4px_4px_0px_#0f172a] transition duration-200 animate-fade-in">
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {adm.email}
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {adm.canManageAdmins ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono font-bold text-[8px] uppercase">
                            Full Admin (Super)
                          </span>
                        ) : (
                          <>
                            {adm.canEdit && (
                              <span className="inline-block px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-mono font-bold text-[8px] uppercase">
                                Editor
                              </span>
                            )}
                            {adm.canDelete && (
                              <span className="inline-block px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 font-mono font-bold text-[8px] uppercase font-bold">
                                Deleter
                              </span>
                            )}
                            {!adm.canEdit && !adm.canDelete && (
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[8px] uppercase">
                                Observer
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteAdmin(adm.email)}
                      className="p-2 ml-4 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border-2 border-slate-900 rounded-lg transition-all duration-200 cursor-pointer"
                      title={lang === 'hi' ? "प्रबंधन विशेषाधिकार रद्द करें" : "Revoke credentials"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Action Editor Form Tab - STYLED IN ULTRAPREMIUM CHIC MINIMAL RETRO WEB STYLE */
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-8 max-w-4xl mx-auto shadow-[6px_6px_0px_#0f172a] relative overflow-hidden mb-12 animate-fade-in bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:16px_16px]">
          
          <div className="flex items-center space-x-3.5 pb-4 mb-6 border-b-2 border-slate-900 border-dashed">
            <div className="bg-amber-400 p-3 rounded-xl text-slate-950 border-2 border-slate-900 shadow-[2px_2px_0px_#000]">
              <FilePlus className="h-5.5 w-5.5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-sketch font-black text-slate-900 uppercase">
                {editingPdf ? t.editPdf : t.indexNewPdf}
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 font-semibold font-sans mt-0.5">Define your high-speed study materials gateway values below.</p>
            </div>
          </div>

          <form onSubmit={triggerSaveCollectionEntry} className="space-y-5 text-sm">
            
            {/* Row 1: Title & Predefined Dropdown Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5">
                  {t.titleInput} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UPSC Prelims General Studies Phase 1 Notes"
                  value={formTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormTitle(val);
                    if (!editingPdf) {
                      const cleanSlug = val
                        .toLowerCase()
                        .slice(0, 100)
                        .replace(/[^a-z0-9\s-]/g, '') // keeps alphanumeric, space, dash
                        .trim()
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-');
                      setFormId(cleanSlug);
                    }
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-900 focus:bg-white placeholder-slate-400 text-slate-800 text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5">
                  {t.categoryInput}
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-900 text-slate-800 text-xs sm:text-sm font-bold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200 cursor-pointer"
                >
                  {categories.map((cat, i) => (
                    <option key={i} value={cat}>{cat}</option>
                  ))}
                  <option value="Other (Type Custom Category Below)">Other (Type Custom Category Below)</option>
                </select>
              </div>
            </div>

            {/* Row 2: Custom Category Addition */}
            {formCategory === 'Other (Type Custom Category Below)' && (
              <div className="animate-slide-down">
                <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5">
                  {t.orCustomCategory}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.customCategoryPlaceholder}
                  value={formCustomCategory}
                  onChange={(e) => setFormCustomCategory(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-900 focus:bg-white text-slate-800 text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200"
                />
              </div>
            )}

            {/* Row 3: Unique slug, size, & pages */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5 flex justify-between items-center">
                  <span>🔗 {lang === 'hi' ? 'एसईओ वेब यूआरएल (Slug)' : 'SEO Friendly URL Slug'}</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-sans font-bold px-1 py-0.2 rounded uppercase">Auto</span>
                </label>
                <input
                  type="text"
                  required
                  disabled
                  placeholder="Generated from document title..."
                  value={formId}
                  className="w-full bg-slate-100 border-2 border-slate-900 text-slate-500 text-xs sm:text-sm font-mono font-bold px-4 py-3 rounded-xl cursor-not-allowed"
                />
                <p className="text-[9.5px] text-slate-400 font-bold mt-1 select-none">Creates clean, optimized, semantic URLs.</p>
              </div>

              <div>
                <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5">
                  {t.sizeInput}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5.4 MB"
                  value={formFileSize}
                  onChange={(e) => setFormFileSize(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-900 focus:bg-white text-slate-800 text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5">
                  {t.pageInput}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formPageCount}
                  onChange={(e) => setFormPageCount(Number(e.target.value))}
                  className="w-full bg-slate-50 border-2 border-slate-900 focus:bg-white text-slate-800 text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200"
                />
              </div>
            </div>

            {/* Row 4: Third-Party resource links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5">
                  {t.viewUrlInput} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="e.g. https://drive.google.com/file/d/xxxxxx/view"
                  value={formThirdPartyViewUrl}
                  onChange={(e) => setFormThirdPartyViewUrl(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-900 focus:bg-white placeholder-slate-400 text-slate-800 text-xs sm:text-sm font-mono font-bold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200"
                />
                <p className="text-[10px] text-slate-500 font-bold mt-1.5 font-sans">Google Drive view or preview link.</p>
              </div>

              <div>
                <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5">
                  {t.downloadUrlInput} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="e.g. https://drive.google.com/uc?export=download&id=xxxxxx"
                  value={formThirdPartyDownloadUrl}
                  onChange={(e) => setFormThirdPartyDownloadUrl(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-900 focus:bg-white placeholder-slate-400 text-slate-800 text-xs sm:text-sm font-mono font-bold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200"
                />
                <p className="text-[10px] text-slate-500 font-bold mt-1.5 font-sans">Direct Download URL for users.</p>
              </div>
            </div>

            {/* Row 4.5: Cover/Banner Image URL input */}
            <div className="bg-[#FCFAF2] p-4 rounded-xl border-2 border-slate-900">
              <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5 flex flex-wrap items-center gap-1.5 text-left">
                <span>🎨 Book Cover/Banner Image URL (किताब का बैनर चित्र)</span>
                <span className="text-[10px] text-slate-500 font-bold normal-case">(Optional)</span>
              </label>
              <input
                type="url"
                placeholder="e.g. https://images.unsplash.com/photo-xxxxxxx?auto=format&fit=crop&q=80&w=600"
                value={formCoverUrl}
                onChange={(e) => setFormCoverUrl(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 placeholder-slate-400 text-slate-800 text-xs sm:text-sm font-mono font-bold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 transition duration-200"
              />
            </div>

            {/* Members-Only Gated Resource status toggle */}
            <div className="bg-[#FFFBEB] p-4 rounded-xl border-2 border-slate-900 flex items-center justify-between shadow-[2px_2px_0px_#000]">
              <div className="min-w-0 pr-4 flex-1">
                <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 flex items-center space-x-1.5 text-left">
                  <span>🔒 {lang === 'hi' ? 'केवल लॉग-इन उपयोगकर्ताओं के लिए' : 'Members Only Download Restriction'}</span>
                </label>
                <p className="text-[10px] text-slate-500 font-bold leading-normal mt-1 text-left">
                  {lang === 'hi' 
                    ? 'सक्रिय करने पर, केवल गूगल से लॉग-इन छात्र ही इस अध्ययन सामग्री को देख और डाउनलोड कर पाएंगे।' 
                    : 'When checked, visitors must login with Google to unlock link clearance and download.'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={formMembersOnly}
                onChange={(e) => setFormMembersOnly(e.target.checked)}
                className="h-6 w-6 rounded border-2 border-slate-900 text-amber-500 focus:ring-amber-200 cursor-pointer shrink-0 accent-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-sketch font-bold uppercase tracking-wide text-slate-800 mb-1.5">
                {t.descInput}
              </label>
              <textarea
                rows={3}
                placeholder="Specify core syllabus coverage, chapter chapters highlights, questions included..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-900 focus:bg-white text-slate-800 text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl outline-none focus:ring-4 focus:ring-amber-200/50 resize-y leading-relaxed transition duration-200"
              ></textarea>
            </div>

            {/* Form Save triggers in thick sketch style */}
            <div className="pt-4 border-t-2 border-slate-900 border-dashed flex items-center justify-end space-x-3.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('manage');
                  resetForm();
                }}
                className="bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-800 font-sketch font-bold px-5 py-3 rounded-xl text-xs transition-all shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
              >
                {t.cancel}
              </button>

              <button
                type="submit"
                className="bg-[#A3E635] border-2 border-slate-900 hover:bg-[#bbf054] text-slate-900 font-sketch font-black px-6 py-3 rounded-xl text-xs transition-all flex items-center space-x-1.5 shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
              >
                <span>{editingPdf ? t.saveChanges : t.uploadRecord}</span>
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
