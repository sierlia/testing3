import { useState } from "react";
import { Plus, Edit2, Trash2, Check, X } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagManagerProps {
  onTagsChange: (tags: string[]) => void;
}

export function TagManager({ onTagsChange }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([
    {
      id: "1",
      name: "Mr. Litzenberger Period 6",
      color: "blue",
    },
    { id: "2", name: "Ms. Beito Period 2", color: "green" },
    { id: "3", name: "Advanced Civics", color: "purple" },
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(
    null,
  );
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    if (newTagName.trim()) {
      const newTag: Tag = {
        id: Date.now().toString(),
        name: newTagName.trim(),
        color: "blue",
      };
      setTags([...tags, newTag]);
      setNewTagName("");
      setIsCreating(false);
    }
  };

  const handleEdit = (id: string) => {
    const tag = tags.find((t) => t.id === id);
    if (tag) {
      setEditingId(id);
      setEditName(tag.name);
    }
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editingId) {
      setTags(
        tags.map((t) =>
          t.id === editingId
            ? { ...t, name: editName.trim() }
            : t,
        ),
      );
      setEditingId(null);
      setEditName("");
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this tag?")) {
      setTags(tags.filter((t) => t.id !== id));
    }
  };

  return (
    <div className="space-y-3">
      {/* Tag list */}
      {tags.map((tag) => (
        <div key={tag.id} className="group">
          {editingId === tag.id ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSaveEdit()
                }
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveEdit}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setEditName("");
                }}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
              <span className="text-sm font-medium text-gray-900 truncate">
                {tag.name}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(tag.id)}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Create new tag */}
      {isCreating ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Tag name..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && handleCreate()
            }
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            autoFocus
          />
          <button
            onClick={handleCreate}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setIsCreating(false);
              setNewTagName("");
            }}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Tag
        </button>
      )}
    </div>
  );
}