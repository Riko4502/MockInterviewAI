// export default function Home() {
//   return <main>Mock Interview AI</main>;
// }

// import { Avatar, AvatarImage, AvatarFallback } from "@packages/ui";
//
// export default function Home() {
//   return (
//     <main className="p-10 flex items-center gap-4">
//       <Avatar size="lg">
//         <AvatarImage src="https://github.com/shadcn.png" alt="User Avatar" />
//         <AvatarFallback>CN</AvatarFallback>
//       </Avatar>
//
//       <Avatar size="md">
//         <AvatarFallback>AI</AvatarFallback>
//       </Avatar>
//     </main>
//   );
// }

import { Avatar } from "@packages/ui";

export default function Home() {
  return (
    <main className="p-10 flex items-center gap-4">
      <Avatar size="lg">
        <Avatar.Image src="https://github.com/shadcn.png" alt="User Avatar" />
        <Avatar.Fallback>CN</Avatar.Fallback>
      </Avatar>

      <Avatar size="md">
        <Avatar.Fallback>AI</Avatar.Fallback>
      </Avatar>
    </main>
  );
}
