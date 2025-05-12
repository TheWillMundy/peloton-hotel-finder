"use client";

import React from 'react';

const SearchResultMarker: React.FC = () => {
  const pinStyles: React.CSSProperties = {
    width: "30px",
    height: "30px",
    background: "#FF4D94",
    borderRadius: "50% 50% 50% 0",
    transform: "rotate(-45deg)",
    margin: "10px 0 0 10px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
    border: "2px solid white",
    position: "relative"
  };

  const innerStyles: React.CSSProperties = {
    width: "14px",
    height: "14px",
    background: "white",
    borderRadius: "50%",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)"
  };

  return (
    <div className="search-result-marker">
      <div style={pinStyles}>
        <div style={innerStyles} />
      </div>
    </div>
  );
};

export default React.memo(SearchResultMarker); 