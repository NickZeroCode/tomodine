import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useRestaurant } from "@/context/RestaurantContext";
import { Icon } from "@/components/Icon";
import { LoadingState } from "@/components/States";
import { getSoundEnabled, setSoundEnabled as persistSound } from "@/hooks/useNotificationSound";

/* ── Reusable inline-edit row ────────────────────────────────── */

function EditableField({
  label,
  value,
  type = "text",
  onSave,
}: {
  label: string;
  value: string;
  type?: "text" | "email" | "tel" | "time" | "textarea";
  onSave: (val: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && type !== "textarea") {
      e.preventDefault();
      void handleSave();
    }
    if (e.key === "Escape") handleCancel();
  }

  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-400">{label}</p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            {type === "textarea" ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                className="input min-h-[64px] flex-1 resize-y text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={type}
                className="input flex-1 text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="shrink-0 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "…" : t("common.save")}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="shrink-0 rounded-lg px-2 py-2 text-xs text-ink-400 hover:text-ink-700"
            >
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <p className="mt-0.5 text-sm text-ink-900">{value || "—"}</p>
        )}
      </div>
      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
        >
          {t("common.edit")}
        </button>
      )}
    </div>
  );
}

/* ── Image upload with inline edit ────────────────────────────── */

function ImageUpload({
  currentUrl,
  onUpload,
  onRemove,
  shape = "rounded",
}: {
  currentUrl: string | null | undefined;
  onUpload: (file: File) => void;
  onRemove?: () => void;
  shape?: "rounded" | "circle";
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onUpload(file);
  }

  const displayUrl = preview ?? currentUrl;
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <div className="flex items-center gap-4">
      <div className={`h-16 w-16 shrink-0 overflow-hidden border-2 border-ink-100 bg-ink-50 ${shapeClass}`}>
        {displayUrl ? (
          <img src={displayUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon name="image" className="h-6 w-6 text-ink-300" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50" onClick={() => inputRef.current?.click()}>
          {displayUrl ? t("settings.changeImage") : t("settings.uploadImage")}
        </button>
        {displayUrl && onRemove && (
          <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50" onClick={() => { setPreview(null); onRemove(); }}>
            {t("settings.removeImage")}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  );
}

/* ── Section wrapper ──────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-ink-100 bg-[#EDF6F5] px-5 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-600">{title}</h3>
      </div>
      <div className="divide-y divide-ink-50 px-5">{children}</div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────── */

export function SettingsPage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const [soundOn, setSoundOn] = useState(getSoundEnabled());

  async function saveField(field: string, value: string) {
    if (!restaurant) return;
    await api.patch(`/restaurants/${restaurant.slug}/`, { [field]: value });
    await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
  }

  async function uploadRestaurantImage(field: "logo" | "cover_image", file: File) {
    if (!restaurant) return;
    const fd = new FormData();
    fd.append(field, file);
    await api.patch(`/restaurants/${restaurant.slug}/`, fd);
    await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
  }

  async function removeRestaurantImage(field: "logo" | "cover_image") {
    if (!restaurant) return;
    await api.patch(`/restaurants/${restaurant.slug}/`, { [field]: null });
    await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
  }

  async function uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append("avatar", file);
    await api.patch("/auth/me/", fd);
    refreshUser?.();
  }

  if (!restaurant) return <LoadingState />;

  return (
    <section aria-labelledby="settings-heading" className="max-w-2xl space-y-5">
      <h2 id="settings-heading" className="text-lg font-semibold text-ink-900">
        {t("settings.title")}
      </h2>

      {/* Profile picture */}
      <Section title={t("settings.profilePicture")}>
        <div className="py-4">
          <ImageUpload currentUrl={user?.avatar} onUpload={uploadAvatar} shape="circle" />
        </div>
      </Section>

      {/* Restaurant images */}
      <Section title={`${t("settings.logo")} & ${t("settings.coverImage")}`}>
        <div className="space-y-4 py-4">
          <ImageUpload currentUrl={restaurant.logo} onUpload={(f) => uploadRestaurantImage("logo", f)} onRemove={() => removeRestaurantImage("logo")} />
          <ImageUpload currentUrl={restaurant.cover_image} onUpload={(f) => uploadRestaurantImage("cover_image", f)} onRemove={() => removeRestaurantImage("cover_image")} />
        </div>
      </Section>

      {/* Restaurant profile — inline-edit fields */}
      <Section title={t("settings.restaurantProfile")}>
        <EditableField label={t("settings.restaurantName")} value={restaurant.name} onSave={(v) => saveField("name", v)} />
        <EditableField label={t("settings.description")} value={restaurant.description} type="textarea" onSave={(v) => saveField("description", v)} />
        <EditableField label={t("settings.phone")} value={restaurant.phone} type="tel" onSave={(v) => saveField("phone", v)} />
        <EditableField label={t("settings.email")} value={restaurant.email} type="email" onSave={(v) => saveField("email", v)} />
        <EditableField label={t("settings.address")} value={restaurant.address_line} onSave={(v) => saveField("address_line", v)} />
      </Section>

      {/* Business hours */}
      <Section title={t("settings.businessHours")}>
        <div className="grid grid-cols-2 gap-4">
          <EditableField label={t("settings.openingTime")} value={restaurant.opening_time ?? ""} type="time" onSave={(v) => saveField("opening_time", v)} />
          <EditableField label={t("settings.closingTime")} value={restaurant.closing_time ?? ""} type="time" onSave={(v) => saveField("closing_time", v)} />
        </div>
      </Section>

      {/* Notification settings */}
      <Section title={t("notifications.title")}>
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-ink-900">{t("notifications.soundAlerts")}</p>
            <p className="text-xs text-ink-500">{t("notifications.soundAlertsDesc")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={soundOn}
            onClick={() => { persistSound(!soundOn); setSoundOn(!soundOn); }}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${soundOn ? "bg-orange-500" : "bg-ink-300"}`}
          >
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${soundOn ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </Section>
    </section>
  );
}
