import { NextResponse } from "next/server";
import { sendToChatwork } from "@/lib/chatwork";

export async function POST(request: Request) {
  try {
    const { message, roomId } = await request.json();

    const apiToken = process.env.CHATWORK_API_TOKEN;
    const defaultRoomId = roomId || process.env.CHATWORK_ROOM_ID;

    if (!apiToken) {
      return NextResponse.json(
        { success: false, error: "CHATWORK_API_TOKEN が設定されていません" },
        { status: 500 }
      );
    }

    if (!defaultRoomId) {
      return NextResponse.json(
        { success: false, error: "CHATWORK_ROOM_ID が設定されていません" },
        { status: 500 }
      );
    }

    const result = await sendToChatwork(apiToken, defaultRoomId, message);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Chatwork send error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "送信に失敗しました" },
      { status: 500 }
    );
  }
}

