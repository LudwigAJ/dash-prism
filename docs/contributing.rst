Contributing
============

Setup
-----

.. code-block:: bash

   git clone https://github.com/yourusername/dash_prism.git
   cd dash_prism
   python -m venv .venv
   source .venv/bin/activate
   npm install
   npm run build
   pip install -e ".[dev,test]"

Tests
-----

.. code-block:: bash

   pytest tests/ -v
   pytest --cov=dash_prism

Code Style
----------

- Python: Black, isort
- TypeScript: ESLint, Prettier

Building Docs
-------------

.. code-block:: bash

   pip install sphinx sphinx-rtd-theme
   cd docs
   make html


Future Improvements
-------------------

Toaster Notifications
^^^^^^^^^^^^^^^^^^^^^

**Problem:** When the user either has an action blocked due to limits 
(Maximum Tabs reached, spawning additional non-``allow_multple=True`` layouts, etc...)
this is currently only shown in the console.

**Solution:** Use `components/ui/toaser.tsx` and implement so we show toasts instead:

.. code-block:: tsx

   import { Toaster as Sonner } from 'sonner';
   import { useConfig } from '../../context/ConfigContext';

   type ToasterProps = React.ComponentProps<typeof Sonner>;

   const Toaster = ({ ...props }: ToasterProps) => {
      const { theme } = useConfig();

      return (
         <Sonner
            theme={theme as ToasterProps['theme']}
            className="toaster group bg-background text-foreground"
            toastOptions={{
            classNames: {
               toast:
                  'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
               description: 'group-[.toast]:text-muted-foreground',
               actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
               cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
            },
            }}
            {...props}
         />
      );
   };