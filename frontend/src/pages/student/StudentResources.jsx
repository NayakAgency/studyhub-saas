import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import SearchBar from '../../components/ui/SearchBar.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatDate, formatFileSize } from '../../lib/utils.js';
import { FileText, ExternalLink, Library } from 'lucide-react';

export default function StudentResources() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'resources', search],
    queryFn: () => api.get('/student/resources', { params: { search } }).then((r) => r.data),
  });

  return (
    <div className="p-5 space-y-5 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Study Resources</h1>
        <p className="text-sm text-gray-500 mt-0.5">PDFs uploaded by your hall admin</p>
      </div>

      <SearchBar placeholder="Search by title or subject…" onSearch={setSearch} />

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl skeleton" />)}</div>
      ) : data?.length === 0 ? (
        <Card className="p-8 text-center">
          <Library className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No resources available</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {data?.map((r) => (
            <Card key={r.id} className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{r.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {r.subject_tag && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{r.subject_tag}</span>
                  )}
                  <span className="text-xs text-gray-400">{formatFileSize(r.file_size_bytes)}</span>
                  <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                </div>
                {r.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.description}</p>}
              </div>
              <a href={r.file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Open</Button>
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
