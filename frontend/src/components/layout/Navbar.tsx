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
  const [previousDesktopIndex, setPreviousDesktopIndex] = React.useState<number | null>(null);
  const [desktopDirection, setDesktopDirection] = React.useState<"left" | "right" | null>(null);
  const [desktopIndicator, setDesktopIndicator] = React.useState({
    left: 0,
    width: 0,
    ready: false,
  });
  const desktopNavRef = React.useRef<HTMLDivElement | null>(null);
  const desktopLinkRefs = React.useRef<Array<HTMLAnchorElement | null>>([]);
  const desktopIndexRef = React.useRef(0);
  const desktopHydratedRef = React.useRef(false);
  const scrolled = useScroll(10);
  const showFramedShell = scrolled || open;
  const navItems = user?.isAdmin ? [...NAV_ITEMS, { label: "Admin", path: "/admin" }] : NAV_ITEMS;
  const activeIndex = React.useMemo(() => {
    const index = navItems.findIndex((item) =>
      item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
    );
    return index >= 0 ? index : 0;
  }, [location.pathname, navItems]);

  const measureDesktopIndicator = React.useCallback(() => {
    const currentLink = desktopLinkRefs.current[activeIndex];
    if (!currentLink) return;
    setDesktopIndicator({
      left: currentLink.offsetLeft,
      width: currentLink.offsetWidth,
      ready: true,
    });
  }, [activeIndex]);

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

  React.useLayoutEffect(() => {
    measureDesktopIndicator();
  }, [measureDesktopIndicator]);

  React.useEffect(() => {
    const navEl = desktopNavRef.current;
    if (!navEl) return;

    const resizeObserver = new ResizeObserver(() => {
      measureDesktopIndicator();
    });
    resizeObserver.observe(navEl);

    const onWindowResize = () => {
      measureDesktopIndicator();
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [measureDesktopIndicator]);

  React.useEffect(() => {
    if (!desktopHydratedRef.current) {
      desktopHydratedRef.current = true;
      desktopIndexRef.current = activeIndex;
      return;
    }

    const previousIndex = desktopIndexRef.current;
    if (previousIndex === activeIndex) return;

    setPreviousDesktopIndex(previousIndex);
    setDesktopDirection(activeIndex > previousIndex ? "right" : "left");
    desktopIndexRef.current = activeIndex;

    const timeoutId = window.setTimeout(() => {
      setDesktopDirection(null);
    }, 460);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeIndex]);

  function isActivePath(path: string) {
    return path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
  }

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header
      className={cn(
        "ba-liquid-navbar-shell sticky top-0 z-50 mx-auto mb-3 w-full max-w-7xl rounded-full border border-transparent px-3 pt-[env(safe-area-inset-top)] md:top-4 md:mb-6 md:px-4 md:pt-0 md:origin-top md:transition-all md:duration-300 md:ease-out lg:px-8",
        showFramedShell ? "ba-liquid-navbar-shell-scrolled" : "ba-liquid-navbar-shell-top",
        scrolled && !open ? "md:max-w-6xl md:scale-[0.985]" : "",
        open ? "ba-liquid-navbar-shell-open" : "",
      )}
    >
      <svg className="ba-liquid-nav-filter-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter
            id="ba-navbar-glass-filter"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              result="map"
              width="100%"
              height="100%"
              x="0"
              y="0"
              preserveAspectRatio="none"
              href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0%25' stop-color='rgb(110,128,128)'/%3E%3Cstop offset='50%25' stop-color='rgb(128,128,128)'/%3E%3Cstop offset='100%25' stop-color='rgb(146,128,128)'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale="22"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <filter
            id="ba-navbar-glass-filter-edge"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              result="mapEdge"
              width="100%"
              height="100%"
              x="0"
              y="0"
              preserveAspectRatio="none"
              href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='g2' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0%25' stop-color='rgb(95,128,128)'/%3E%3Cstop offset='50%25' stop-color='rgb(128,128,128)'/%3E%3Cstop offset='100%25' stop-color='rgb(161,128,128)'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g2)'/%3E%3C/svg%3E"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="mapEdge"
              scale="46"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <nav
        className={cn(
          "ba-liquid-navbar-inner flex h-14 w-full items-center justify-between px-2 md:h-12 md:px-4 md:transition-all md:duration-300 md:ease-out lg:px-5",
        )}
      >
        <Link to="/" onClick={closeMenu} className="flex items-center gap-2 pl-1 md:pl-2">
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--ba-font-display)", color: "#012169" }}
          >
            BetterAtlas
          </span>
        </Link>

        <div
          ref={desktopNavRef}
          className="ba-liquid-desktop-nav hidden items-center gap-1 md:flex"
          data-current={activeIndex + 1}
          data-previous={previousDesktopIndex !== null ? previousDesktopIndex + 1 : undefined}
          data-direction={desktopDirection ?? undefined}
        >
          <span
            className={cn(
              "ba-liquid-desktop-indicator",
              desktopIndicator.ready ? "ba-liquid-desktop-indicator-ready" : "",
            )}
            style={
              {
                "--ba-nav-left": `${desktopIndicator.left}px`,
                "--ba-nav-width": `${desktopIndicator.width}px`,
              } as React.CSSProperties
            }
            aria-hidden="true"
          />
          {navItems.map((item, index) => (
            <Link
              key={item.path}
              to={item.path}
              ref={(el) => {
                desktopLinkRefs.current[index] = el;
              }}
              data-c-option={index + 1}
              className={cn(
                "ba-liquid-desktop-link",
                isActivePath(item.path) ? "ba-liquid-desktop-link-active" : "",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 pr-1 md:flex md:pr-2">
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
            "ba-liquid-menu-shell fixed right-0 bottom-0 left-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 flex flex-col overflow-hidden md:hidden",
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
