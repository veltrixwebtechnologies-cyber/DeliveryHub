import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/modules/admin/pages/delivery-admin";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Delivery admin — Local Shore" },
      {
        name: "description",
        content:
          "Approve delivery partners, review documents, monitor live deliveries and release rider payouts.",
      },
      { property: "og:title", content: "Delivery admin — Local Shore" },
      {
        property: "og:description",
        content: "Partner approvals, document verification, live delivery monitoring and payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});
