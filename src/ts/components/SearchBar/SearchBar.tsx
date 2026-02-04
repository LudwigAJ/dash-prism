import React, { memo } from 'react';
import { useSearchBarState } from './useSearchBarState';
import { DisplayMode } from './DisplayMode';
import { SearchMode } from './SearchMode';
import { ParamsMode } from './ParamsMode';
import { OptionsMode } from './OptionsMode';

type SearchBarProps = {
  panelId: string;
  isPinned?: boolean;
};

export const SearchBar = memo(function SearchBar({ panelId }: SearchBarProps) {
  const {
    mode,
    searchQuery,
    showDropdown,
    dropdownHeight,
    activeTab,
    currentLayout,
    filteredLayouts,
    selectedLayout,
    paramOptions,
    currentParam,
    paramValues,
    currentParamIndex,
    allParams,
    favoriteLayouts,
    searchBarPlaceholder,
    inputRef,
    commandRef,
    setSearchQuery,
    setParamValues,
    handleLayoutSelect,
    handleOptionSelect,
    handleBackToLayouts,
    handleDisplayClick,
    handleDisplayKeyDown,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleClick,
    handleResizeStart,
    handleToggleFavorite,
  } = useSearchBarState(panelId);

  // Hidden mode
  if (mode === 'hidden') {
    return null;
  }

  // Display mode
  if (mode === 'display' && currentLayout) {
    return (
      <DisplayMode
        currentLayoutName={currentLayout.name}
        activeTab={activeTab}
        onDisplayClick={handleDisplayClick}
        onKeyDown={handleDisplayKeyDown}
      />
    );
  }

  // Params mode
  if (mode === 'params' && currentParam) {
    return (
      <ParamsMode
        selectedLayoutName={selectedLayout?.name ?? ''}
        currentParam={currentParam}
        currentParamIndex={currentParamIndex}
        totalParams={allParams.length}
        paramValue={paramValues[currentParam.name] ?? ''}
        onParamValueChange={(value) =>
          setParamValues((v) => ({ ...v, [currentParam.name]: value }))
        }
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onCancel={handleBackToLayouts}
        inputRef={inputRef}
      />
    );
  }

  // Options mode
  if (mode === 'options' && paramOptions) {
    return (
      <OptionsMode
        selectedLayoutName={selectedLayout?.name ?? ''}
        paramOptions={paramOptions}
        showDropdown={showDropdown}
        dropdownHeight={dropdownHeight}
        onOptionSelect={handleOptionSelect}
        onBackToLayouts={handleBackToLayouts}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => {}}
        onResizeStart={handleResizeStart}
        inputRef={inputRef}
        commandRef={commandRef}
      />
    );
  }

  // Search mode (default)
  return (
    <SearchMode
      searchQuery={searchQuery}
      filteredLayouts={filteredLayouts}
      favoriteLayouts={favoriteLayouts}
      showDropdown={showDropdown}
      dropdownHeight={dropdownHeight}
      searchBarPlaceholder={searchBarPlaceholder}
      onSearchQueryChange={setSearchQuery}
      onLayoutSelect={handleLayoutSelect}
      onToggleFavorite={handleToggleFavorite}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onResizeStart={handleResizeStart}
      inputRef={inputRef}
      commandRef={commandRef}
    />
  );
});

SearchBar.displayName = 'SearchBar';
