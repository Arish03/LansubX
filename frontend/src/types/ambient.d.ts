/// <reference types="node" />

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module "react" {
  export = any;
  const anyVal: any;
  export default anyVal;
}

declare module "react-dom" {
  export = any;
}

declare module "swr" {
  const useSWR: any;
  export default useSWR;
}

declare module "next/navigation" {
  export const useRouter: any;
  export const usePathname: any;
  export const useParams: any;
  export const Link: any;
  const DefaultLink: any;
  export default DefaultLink;
}

declare module "recharts" {
  export const ResponsiveContainer: any;
  export const AreaChart: any;
  export const Area: any;
  export const XAxis: any;
  export const YAxis: any;
  export const Tooltip: any;
  export const CartesianGrid: any;
  export const LineChart: any;
  export const Line: any;
}

declare module "lucide-react" {
  export const [key: string]: any;
}
