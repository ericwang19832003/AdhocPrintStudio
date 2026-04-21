import * as React from "react";

const Root = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  function Table({ className, children, ...rest }, ref) {
    return (
      <table ref={ref} className={`psd-table ${className ?? ""}`} {...rest}>
        {children}
      </table>
    );
  }
);

const Header = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...props} />;
const Body = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} />;
const Row = (props: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...props} />;
const HeadCell = (props: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...props} />;
const Cell = (props: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...props} />;

export const Table = Object.assign(Root, { Header, Body, Row, HeadCell, Cell });
