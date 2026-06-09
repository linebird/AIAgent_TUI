import type { Message, FileAttachment } from "@/types";
import { FileText, Code, File } from "lucide-react";

const FILE_ICON: Record<string, React.ReactNode> = {
  FileText: <FileText size={15} />,
  Code: <Code size={15} />,
  File: <File size={15} />,
};

function FileChip({ f }: { f: FileAttachment }) {
  return (
    <span className="attach-chip" style={{ boxShadow: "none" }}>
      <span className="ac-ico">{FILE_ICON[f.icon] ?? <File size={15} />}</span>
      <span>
        <span className="ac-name">{f.name}</span>
        <span className="ac-meta">{f.size}</span>
      </span>
    </span>
  );
}

export default function UserMessage({ msg }: { msg: Message }) {
  return (
    <div className="msg msg-user">
      <div className="bubble">
        {msg.files && msg.files.length > 0 && (
          <div className="files">
            {msg.files.map((f, i) => <FileChip key={i} f={f} />)}
          </div>
        )}
        {msg.text}
      </div>
    </div>
  );
}
