import React from 'react';
import { Toaster as Sonner } from 'sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme, componentId } = useConfig();

  return (
    <Sonner
      id={componentId}
      theme={theme}
      position="top-center"
      className="toaster tw:group"
      icons={{
        success: <CircleCheckIcon className="tw:size-4" />,
        info: <InfoIcon className="tw:size-4" />,
        warning: <TriangleAlertIcon className="tw:size-4" />,
        error: <OctagonXIcon className="tw:size-4" />,
        loading: <Loader2Icon className="tw:size-4 tw:animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--card)',
          '--normal-text': 'var(--card-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'tw:shadow-lg',
          cancelButton: 'tw:bg-muted tw:text-muted-foreground tw:hover:bg-muted/80',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
