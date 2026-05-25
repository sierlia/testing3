import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { supabase } from "../utils/supabase";

type HelpContactFormProps = {
  title?: string;
  description?: string;
  submitLabel?: string;
};

export function HelpContactForm({
  title = "Still have a question?",
  description = "Send a question or message that is not answered here.",
  submitLabel = "Submit message",
}: HelpContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please include your name, email, and message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("help_messages").insert({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        user_id: auth.user?.id ?? null,
      } as any);
      if (error) throw error;
      setName("");
      setEmail("");
      setMessage("");
      toast.success("Message submitted.");
    } catch (error: any) {
      toast.error(error.message || "Could not submit message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={5}
        placeholder="Message or question"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>{busy ? "Submitting" : submitLabel}</Button>
      </div>
    </form>
  );
}
