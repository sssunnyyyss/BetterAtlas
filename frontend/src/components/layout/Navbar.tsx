import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth.js";
import { Button } from "../ui/button.js";
import { MenuToggleIcon } from "../ui/menu-toggle-icon.js";
import { useScroll } from "../ui/use-scroll.js";
import { cn } from "../../lib/utils.js";

const NAV_ITEMS = [
  { label: "Home", path: "/" },
  { label: "Catalog", path: "/catalog" },
  { label: "My Schedule", path: "/schedule" },
  { label: "Wishlist", path: "/wishlist" },
  { label: "Friends", path: "/friends" },
];
const MENU_TRANSITION_MS = 360;

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const [renderMenu, setRenderMenu] = React.useState(false);
  const scrolled = useScroll(10);
  const navItems = user?.isAdmin ? [...NAV_ITEMS, { label: "Admin", path: "/admin" }] : NAV_ITEMS;

  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setRenderMenu(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRenderMenu(false);
    }, MENU_TRANSITION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  function isActivePath(path: string) {
    return path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
  }

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header
      className={cn(
        "sticky top-4 z-50 mx-auto w-full max-w-7xl border-b border-transparent px-4 md:origin-top md:rounded-xl md:border md:transition-all md:duration-300 md:ease-out lg:px-8",
        scrolled && !open
          ? "bg-background/95 supports-[backdrop-filter]:bg-background/50 border-border backdrop-blur-lg md:max-w-6xl md:scale-[0.985] md:rounded-2xl md:shadow"
          : "",
        open ? "bg-background/90" : "",
      )}
    >
      <nav
        className={cn(
          "flex h-14 w-full items-center justify-between md:h-12 md:transition-all md:duration-300 md:ease-out",
          scrolled ? "md:px-1" : "",
        )}
      >
        <Link to="/" onClick={closeMenu} className="flex items-center gap-2">
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--ba-font-display)", color: "#012169" }}
          >
            BetterAtlas
          </span>
        </Link>

        <div className="ba-liquid-desktop-nav hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "ba-liquid-desktop-link",
                isActivePath(item.path) ? "ba-liquid-desktop-link-active" : "",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Button asChild variant="outline" className="ba-liquid-desktop-auth">
                <Link to="/profile">@{user.username}</Link>
              </Button>
              <Button onClick={() => void logout()} className="ba-liquid-desktop-auth ba-liquid-desktop-auth-primary">
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" className="ba-liquid-desktop-auth">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild className="ba-liquid-desktop-auth ba-liquid-desktop-auth-primary">
                <Link to="/login">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="ba-liquid-toggle md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          data-state={open ? "open" : "closed"}
        >
          <MenuToggleIcon open={open} className="size-5" duration={300} />
        </Button>
      </nav>

      {renderMenu ? (
        <div
          id="mobile-nav-menu"
          className={cn(
            "ba-liquid-menu-shell fixed top-[4.5rem] right-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden md:hidden",
            open ? "ba-liquid-menu-shell-open" : "ba-liquid-menu-shell-closed",
          )}
          aria-hidden={!open}
        >
          <div
            data-state={open ? "open" : "closed"}
            className={cn(
              "ba-liquid-menu-panel flex h-full w-full flex-col justify-between gap-y-2 p-4",
              open ? "ba-liquid-menu-panel-open" : "ba-liquid-menu-panel-closed",
            )}
          >
            <div className="grid gap-y-2">
              {navItems.map((item, index) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeMenu}
                  className={cn(
                    "ba-liquid-menu-link",
                    isActivePath(item.path) ? "ba-liquid-menu-link-active" : "",
                  )}
                  style={{ "--ba-delay": index } as React.CSSProperties}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="grid gap-2">
              {user ? (
                <button
                  className="ba-liquid-menu-link"
                  style={{ "--ba-delay": navItems.length } as React.CSSProperties}
                  onClick={() => {
                    closeMenu();
                    void logout();
                  }}
                >
                  Logout (@{user.username})
                </button>
              ) : (
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="ba-liquid-menu-link ba-liquid-menu-action"
                    style={{ "--ba-delay": navItems.length } as React.CSSProperties}
                  >
                    <Link to="/login" onClick={closeMenu}>
                      Sign In
                    </Link>
                  </Button>
                  <Button
                    asChild
                    className="ba-liquid-menu-link ba-liquid-menu-action ba-liquid-menu-action-primary"
                    style={{ "--ba-delay": navItems.length + 1 } as React.CSSProperties}
                  >
                    <Link to="/login" onClick={closeMenu}>
                      Get Started
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
