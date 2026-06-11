import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { api } from '../../lib/api.js';
import { Camera } from 'lucide-react';

export default function HallGallery() {
  const { slug } = useParams();
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const { data: images, isLoading } = useQuery({
    queryKey: ['public', 'gallery', slug],
    queryFn: () => api.get(`/public/${slug}/gallery`).then((r) => r.data),
  });

  const slides = (images || []).map((img) => ({ src: img.image_url, title: img.caption }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 font-display">Gallery</h1>
        <p className="text-gray-500 mt-2">Take a look inside our study hall</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[1,2,3,4,5,6].map((i) => <div key={i} className="aspect-video rounded-xl skeleton" />)}</div>
      ) : images?.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images?.map((img, i) => (
            <div key={img.id} className="group relative aspect-video rounded-xl overflow-hidden cursor-pointer shadow-card hover:shadow-card-hover transition-all"
              onClick={() => setLightboxIndex(i)}>
              <img src={img.image_url} alt={img.caption || 'Gallery'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              {img.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-white text-xs">{img.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Lightbox open={lightboxIndex >= 0} close={() => setLightboxIndex(-1)} index={lightboxIndex} slides={slides} />
    </div>
  );
}
