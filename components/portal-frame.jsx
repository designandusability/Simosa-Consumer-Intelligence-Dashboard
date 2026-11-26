"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export default function PortalFrame({ sidebar, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? "Show sidebar" : "Hide sidebar";

  return <div className={collapsed ? "portal portal-collapsed" : "portal"}>
    <div className="portal-navigation">
      <div className="portal-controls">
        <button className="button ghost portal-toggle" type="button" aria-expanded={!collapsed}
          aria-controls="portal-sidebar" onClick={() => setCollapsed(value => !value)}>
          <ToggleIcon size={18} aria-hidden="true" />{label}
        </button>
      </div>
      <aside id="portal-sidebar" className="portal-sidebar" hidden={collapsed}>{sidebar}</aside>
    </div>
    {children}
  </div>;
}
