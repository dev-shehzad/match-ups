import React, { useState } from 'react';
import { Star, History, Clock, Trash2 } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch, RootState } from '../../state/store';
import { removeFromFavorites, clearFavorites } from '../../state/slice/favoritesSlice';
import { clearHistory } from '../../state/slice/historySlice';

interface SidebarProps {
  onUrlClick: (url: string) => void;
}


export const Sidebar: React.FC<SidebarProps> = ({ onUrlClick }) => {
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');
  const dispatch = useDispatch<AppDispatch>(); // Use AppDispatch type
  
  const favorites = useSelector((state: RootState) => state.favorites.items);
  const history = useSelector((state: RootState) => state.history.items);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const handleRemoveFavorite = (url: string) => {
    dispatch(removeFromFavorites(url));
  };

  const handleClearFavorites = () => {
    dispatch(clearFavorites());
  };

  const handleClearHistory = () => {
    dispatch(clearHistory());
  };

  return (
    <div className="w-64 bg-gray-800 text-white h-full flex flex-col">
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'favorites'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Star size={16} className="inline-block mr-1" />
          Favorites
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 text-sm font-medium ${
            activeTab === 'history'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <History size={16} className="inline-block mr-1" />
          History
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'favorites' ? (
          <div>
            <div className="flex justify-between items-center p-2">
              <span className="text-sm text-gray-400">Favorites</span>
              {favorites.length > 0 && (
                <button
                  onClick={handleClearFavorites}
                  className="text-gray-400 hover:text-white"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {favorites.map((item) => (
              <div
                key={item.url}
                className="flex items-center justify-between p-2 hover:bg-gray-700 cursor-pointer"
              >
                <div
                  className="flex-1 truncate"
                  onClick={() => onUrlClick(item.url)}
                >
                  <div className="text-sm truncate">{item.title}</div>
                  <div className="text-xs text-gray-400 truncate">{item.url}</div>
                </div>
                <button
                  onClick={() => handleRemoveFavorite(item.url)}
                  className="text-gray-400 hover:text-white ml-2"
                >
                  <Star size={16} className="fill-current" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center p-2">
              <span className="text-sm text-gray-400">History</span>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-gray-400 hover:text-white"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {history.map((item) => (
              <div
                key={item.url}
                className="flex items-center p-2 hover:bg-gray-700 cursor-pointer"
                onClick={() => onUrlClick(item.url)}
              >
                <Clock size={16} className="text-gray-400 mr-2" />
                <div className="flex-1 truncate">
                  <div className="text-sm truncate">{item.title}</div>
                  <div className="text-xs text-gray-400 truncate">{item.url}</div>
                  {/* @ts-ignore */}
                  <div className="text-xs text-gray-500">{formatTimestamp(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 