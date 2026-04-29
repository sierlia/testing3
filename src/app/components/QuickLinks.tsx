import { FileText, Folder, Users, UserCircle, PlusCircle } from "lucide-react";
import { Link } from "react-router";

interface QuickLink {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

export function QuickLinks() {
  const links: QuickLink[] = [
    {
      id: 'create-bill',
      label: 'Create Bill',
      icon: <PlusCircle className="w-5 h-5" />,
      href: '/bills/create'
    },
    {
      id: 'all-bills',
      label: 'All Bills',
      icon: <Folder className="w-5 h-5" />,
      href: '/bills'
    },
    {
      id: 'my-committees',
      label: 'My Committees',
      icon: <Users className="w-5 h-5" />,
      href: '/committee/1/workspace'
    },
    {
      id: 'my-caucuses',
      label: 'My Caucuses',
      icon: <FileText className="w-5 h-5" />,
      href: '/caucuses'
    },
    {
      id: 'my-profile',
      label: 'My Profile',
      icon: <UserCircle className="w-5 h-5" />,
      href: '/profile/me'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
      
      <div className="grid grid-cols-1 gap-2">
        {links.map((link) => (
          <Link
            key={link.id}
            to={link.href}
            className="flex items-center gap-3 px-4 py-3 rounded-md text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors border border-transparent hover:border-gray-200"
          >
            <div className="text-blue-600">
              {link.icon}
            </div>
            <span className="font-medium">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}