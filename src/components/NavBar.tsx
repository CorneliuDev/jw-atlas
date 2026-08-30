"use client";

import { useState } from "react";
import { User, Bell, Bookmark, Plus, Search, SlidersHorizontal } from "lucide-react";

interface NavBarProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
  unreadNotifications: number;
  onAddPlace: () => void;
  onAddTerritory: () => void;
  onAddRoute: () => void;
}

const circleButtonClass =
  "w-10 h-10 rounded-full border-none bg-clay-100/90 backdrop-blur-sm flex items-center justify-center cursor-pointer shadow-sm relative shrink-0 hover:bg-clay-100 transition-colors";

const dropdownClass =
  "absolute top-12 bg-white rounded-lg shadow-lg p-3 font-sans text-sm text-clay-900";

export default function NavBar({
  isLoggedIn,
  unreadNotifications,
  onAddPlace,
  onAddTerritory,
  onAddRoute,
}: NavBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [viewToggleOpen, setViewToggleOpen] = useState(false);

  function closeAllExcept(which: string) {
    setSearchOpen(which === "search");
    setAddContentOpen(which === "add");
    setNotificationsOpen(which === "notifications");
    setBookmarksOpen(which === "bookmarks");
    setViewToggleOpen(which === "view");
  }

  return (
    <>
      {/* Top-left: view-mode toggle */}
      <div className="absolute top-3 left-3 z-20">
        <button
          className={circleButtonClass}
          onClick={() => closeAllExcept(viewToggleOpen ? "" : "view")}
          aria-label="View mode"
          title="View mode"
        >
          <SlidersHorizontal size={18} className="text-clay-900" />
        </button>

        {viewToggleOpen && (
          <div className={`${dropdownClass} left-0 w-52`}>
            <p className="mb-1.5 text-clay-600">View mode (coming soon)</p>
            <label className="block">
              <input type="radio" name="viewMode" defaultChecked className="accent-clay-600" /> Everyone&apos;s
            </label>
            <label className="block">
              <input type="radio" name="viewMode" className="accent-clay-600" /> Just mine
            </label>
          </div>
        )}
      </div>

      {/* Top-right: nav icons */}
      <div className="absolute top-3 right-3 z-20 flex flex-row-reverse items-center gap-2">
        <button
          className={circleButtonClass}
          onClick={() => {
            window.location.href = isLoggedIn ? "/dashboard" : "/login";
          }}
          aria-label="Account"
          title="Account"
        >
          <User size={18} className="text-clay-900" />
        </button>

        {isLoggedIn && (
          <div className="relative">
            <button
              className={circleButtonClass}
              onClick={() => closeAllExcept(notificationsOpen ? "" : "notifications")}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={18} className="text-clay-900" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-clay-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className={`${dropdownClass} right-0 w-64`}>
                <p className="m-0 text-clay-600">
                  Notifications panel coming soon.{" "}
                  <a href="/notifications" className="text-clay-600 underline">
                    View full list
                  </a>
                </p>
              </div>
            )}
          </div>
        )}

        {isLoggedIn && (
          <div className="relative">
            <button
              className={circleButtonClass}
              onClick={() => closeAllExcept(bookmarksOpen ? "" : "bookmarks")}
              aria-label="Bookmarks"
              title="Bookmarks"
            >
              <Bookmark size={18} className="text-clay-900" />
            </button>

            {bookmarksOpen && (
              <div className={`${dropdownClass} right-0 w-56`}>
                <p className="m-0 text-clay-600">
                  Bookmarks panel coming soon.{" "}
                  <a href="/bookmarks" className="text-clay-600 underline">
                    View full list
                  </a>
                </p>
              </div>
            )}
          </div>
        )}

        {isLoggedIn && (
          <div className="relative">
            <button
              className={circleButtonClass}
              onClick={() => closeAllExcept(addContentOpen ? "" : "add")}
              aria-label="Add content"
              title="Add content"
            >
              <Plus size={18} className="text-clay-900" />
            </button>

            {addContentOpen && (
              <div className={`${dropdownClass} right-0 w-44 flex flex-col p-1`}>
                <button
                  onClick={() => {
                    setAddContentOpen(false);
                    onAddPlace();
                  }}
                  className="px-2 py-1.5 rounded text-clay-900 hover:bg-clay-100 text-left"
                  type="button"
                >
                  Place
                </button>
                <a href="/notes/new" className="px-2 py-1.5 rounded text-clay-900 hover:bg-clay-100 no-underline">
                  Note
                </a>
                <button
                  onClick={() => {
                    setAddContentOpen(false);
                    onAddTerritory();
                  }}
                  className="px-2 py-1.5 rounded text-clay-900 hover:bg-clay-100 text-left"
                  type="button"
                >
                  Territory (draw on map)
                </button>
                <button
                  onClick={() => {
                    setAddContentOpen(false);
                    onAddRoute();
                  }}
                  className="px-2 py-1.5 rounded text-clay-900 hover:bg-clay-100 text-left"
                  type="button"
                >
                  Route (draw on map)
                </button>
                <a href="/people/new" className="px-2 py-1.5 rounded text-clay-900 hover:bg-clay-100 no-underline">
                  Person
                </a>
                <a href="/tribes/new" className="px-2 py-1.5 rounded text-clay-900 hover:bg-clay-100 no-underline">
                  Tribe
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center">
          {searchOpen && (
            <input
              type="text"
              placeholder="Search places, people, events..."
              autoFocus
              className="h-10 rounded-full border-none px-4 mr-2 w-56 bg-white/90 font-sans text-sm text-clay-900 placeholder:text-clay-200 focus:outline-none focus:ring-2 focus:ring-clay-300"
            />
          )}
          <button
            className={circleButtonClass}
            onClick={() => closeAllExcept(searchOpen ? "" : "search")}
            aria-label="Search"
            title="Search"
          >
            <Search size={18} className="text-clay-900" />
          </button>
        </div>
      </div>
    </>
  );
}