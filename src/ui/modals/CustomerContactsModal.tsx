import React, { useState } from 'react';
import { Send, ShieldAlert, Pencil, Trash2 } from 'lucide-react';
import { Customer, Contact, User } from '../../modules/types.ts';
import { Modal } from '../components/Modal.tsx';

interface CustomerContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  contacts: Contact[];
  currentUser: User;
  onAddContact: (contactData: {
    name: string;
    position?: string;
    email: string;
    phone: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdateContact: (contactId: string, contactData: {
    name: string;
    position?: string;
    email: string;
    phone: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onDeleteContact: (contactId: string) => Promise<{ success: boolean; error?: string }>;
  onSendMagicLink: (contact: Contact) => Promise<void>;
  onRevokeAccess: (contact: Contact) => Promise<void>;
}

export function CustomerContactsModal({
  isOpen,
  onClose,
  customer,
  contacts,
  currentUser,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onSendMagicLink,
  onRevokeAccess,
}: CustomerContactsModalProps) {
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!customer) return null;

  function handleStartEdit(c: Contact) {
    setEditingContact(c);
    setEditName(c.name);
    setEditPosition(c.position || '');
    setEditEmail(c.email);
    setEditPhone(c.phone || '');
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingContact || !editName.trim() || !editEmail.trim()) return;

    setSaving(true);
    setError(null);
    const res = await onUpdateContact(editingContact.id, {
      name: editName.trim(),
      position: editPosition.trim() || undefined,
      email: editEmail.trim(),
      phone: editPhone.trim(),
    });
    setSaving(false);

    if (res.success) {
      setEditingContact(null);
    } else {
      setError(res.error || 'Error al actualizar contacto');
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPhone.trim()) return;

    setSaving(true);
    setError(null);
    const res = await onAddContact({
      name: newName.trim(),
      position: newPosition.trim() || undefined,
      email: newEmail.trim(),
      phone: newPhone.trim(),
    });
    setSaving(false);

    if (res.success) {
      setNewName('');
      setNewPosition('');
      setNewEmail('');
      setNewPhone('');
    } else {
      setError(res.error || 'Error al agregar contacto');
    }
  }

  const canDeactivate = currentUser.role === 'ADMIN';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Contactos de ${customer.businessName}`}
      titleId="contacts-modal-title"
      maxWidth="xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono -mt-2">
          RUT: {customer.taxId}
        </p>

        {error && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-medium" aria-live="polite">
            {error}
          </div>
        )}

        {/* Contacts List */}
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 space-y-1">
          {contacts.length === 0 ? (
            <p className="py-6 text-center text-slate-400 text-xs">
              No hay contactos registrados aún para este cliente.
            </p>
          ) : (
            contacts.map((contact) => (
              <div key={contact.id} className="py-2.5 text-xs">
                {editingContact?.id === contact.id ? (
                  <form onSubmit={handleSaveEdit} className="p-3 rounded-lg bg-indigo-50/50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-900 dark:text-indigo-200 text-xs">Editar Contacto</span>
                      <button
                        type="button"
                        onClick={() => setEditingContact(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label htmlFor={`edit-contact-name-${contact.id}`} className="sr-only">Nombre</label>
                        <input
                          id={`edit-contact-name-${contact.id}`}
                          type="text"
                          required
                          placeholder="Nombre y Apellido"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-contact-pos-${contact.id}`} className="sr-only">Cargo</label>
                        <input
                          id={`edit-contact-pos-${contact.id}`}
                          type="text"
                          placeholder="Cargo"
                          value={editPosition}
                          onChange={(e) => setEditPosition(e.target.value)}
                          className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-contact-email-${contact.id}`} className="sr-only">Email</label>
                        <input
                          id={`edit-contact-email-${contact.id}`}
                          type="email"
                          required
                          placeholder="Email corporativo"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-contact-phone-${contact.id}`} className="sr-only">Teléfono</label>
                        <input
                          id={`edit-contact-phone-${contact.id}`}
                          type="tel"
                          placeholder="WhatsApp"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingContact(null)}
                        className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-3 py-1 rounded bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {contact.name}
                        </span>
                        {contact.position && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            {contact.position}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono block">
                        {contact.email} {contact.phone ? `• ${contact.phone}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSendMagicLink(contact)}
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                        title="Enviar enlace de acceso al portal"
                        aria-label={`Enviar enlace mágico a ${contact.name}`}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>

                      {!contact.portalTokenRevoked && (
                        <button
                          type="button"
                          onClick={() => onRevokeAccess(contact)}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                          title="Revocar acceso al portal"
                          aria-label={`Revocar acceso a ${contact.name}`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleStartEdit(contact)}
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                        title="Editar datos del contacto"
                        aria-label={`Editar contacto ${contact.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {canDeactivate && (
                        <button
                          type="button"
                          onClick={() => onDeleteContact(contact.id)}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                          title="Dar de baja contacto"
                          aria-label={`Eliminar contacto ${contact.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Contact Form */}
        <form onSubmit={handleAdd} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Agregar Nuevo Contacto:
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label htmlFor="new-contact-name" className="sr-only">Nombre y Apellido</label>
              <input
                id="new-contact-name"
                type="text"
                required
                placeholder="Nombre y Apellido *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="new-contact-position" className="sr-only">Cargo</label>
              <input
                id="new-contact-position"
                type="text"
                placeholder="Cargo (ej: Jefe Operaciones)"
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="new-contact-email" className="sr-only">Email</label>
              <input
                id="new-contact-email"
                type="email"
                required
                placeholder="Email corporativo *"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="new-contact-phone" className="sr-only">Teléfono</label>
              <input
                id="new-contact-phone"
                type="tel"
                required
                placeholder="WhatsApp (+56 9...) *"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || !newName.trim() || !newEmail.trim() || !newPhone.trim()}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer disabled:opacity-50 shadow-xs"
          >
            {saving ? 'Guardando...' : '+ Guardar Contacto y Habilitar Acceso'}
          </button>
        </form>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
