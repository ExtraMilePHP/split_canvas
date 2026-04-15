import React from "react";
import { officeFunFeudAssets } from "./assets";
import "./officeFunFeud.css";

export default function OfficeFunFeudLayout({ children }) {
  return (
    <div className="off-fun-feud-layout">
      <div
        className="off-fun-feud-layout__bg off-fun-feud-layout__bg--desktop"
        style={{ backgroundImage: `url(${officeFunFeudAssets.backgroundDesktop})` }}
        aria-hidden
      />
      <div
        className="off-fun-feud-layout__bg off-fun-feud-layout__bg--mobile"
        style={{ backgroundImage: `url(${officeFunFeudAssets.backgroundMobile})` }}
        aria-hidden
      />
      <div className="off-fun-feud-layout__overlay" aria-hidden />
      <div className="off-fun-feud-layout__content">{children}</div>
    </div>
  );
}
