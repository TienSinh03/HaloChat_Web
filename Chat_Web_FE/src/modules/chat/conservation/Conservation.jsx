import React, { useState, useMemo, useEffect } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import useMessage from "../../../hooks/useMessage"; // Đường dẫn đến hook useMessage
import { useDashboardContext } from "../../../context/Dashboard_context";
import formatTime from "../../../utils/FormatTime";
import "../../../assets/css/ConservationStyle.css";
import ConversationDetail from "./ConservationDetail";
import { useSelector } from "react-redux"; // Import useSelector từ react-redux


import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { toast } from "react-toastify";


const Conservation = ({ onShowDetail, onHideDetail, showDetail }) => {

  // tự động scroll xuống cuối khi có tin nhắn mới
  const bottomRef = React.useRef(null);

  // Lấy selectedConversationId từ Redux
  const selectedConversation = useSelector(
    (state) => state.common.selectedConversation
  );

  // lấy danh sách tin nhắn theo conversationId
  const { messages, isLoadingAllMessages } = useMessage(
    selectedConversation.id
  );

  const messagesMemo = useMemo(() => {
    if (!messages) return [];
    return messages;
  }, [messages]);

  // Lấy currentUser từ context
  const { currentUser } = useDashboardContext();

  console.log("messagesMemo:");
  console.log(messagesMemo);

  const [newMessage, setNewMessage] = useState("");
  const [localMessages, setLocalMessages] = useState([]);  // State để lưu trữ tin nhắn 
  
  console.log("localMessages:", localMessages);

  useEffect(() => {
    if (messagesMemo.response) {
      
      // tự động sort tin nhắn hiển thị tin nhắn nằm ở duới cùng
      const result = messagesMemo.response.sort((a, b) => {
        return new Date(a.timestamp) - new Date(b.timestamp);
      });
      
      setLocalMessages(result); // Cập nhật localMessages từ messagesMemo
    }
  }, [messagesMemo.response]);
  

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [localMessages]);
 

  // connect websocket
  const client = React.useRef(null);

  useEffect(() => {
    const socket = new SockJS('http://localhost:8080/ws'); // Thay thế bằng URL WebSocket của bạn
    client.current = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: (str) => {
        console.log(str);
      },
      onConnect: () => {
        console.log("Connected to WebSocket");
        client.current.subscribe(`/chat/message/single/${selectedConversation.id}`, (message) => {
          const newMessage = JSON.parse(message.body);
          console.log("New message received:", newMessage);

          // Cập nhật tin nhắn mới vào state localMessages
          setLocalMessages((prev) => [...prev, newMessage]);
        });
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
    },
    });

    client.current.activate();

    return () => {
      if (client.current && client.current.connected) {
        client.current.deactivate();
      }
    }
  },[selectedConversation.id])

  // Hàm gửi tin nhắn
  const handleSendMessage = async () => {
    if (newMessage.trim() === "" || !selectedConversation.id) {
      alert("Vui lòng chọn cuộc trò chuyện và nhập tin nhắn");
      return;
    }

    setNewMessage("");

    try {
      const request = {
        conversationId: selectedConversation.id,
        senderId: currentUser.id,
        content: newMessage,
        messageType: "TEXT",
      };

      if (!client.current || !client.current.connected) {
        toast.error("WebSocket không kết nối. Vui lòng thử lại sau.", {
          position: "top-center",
          autoClose: 3000,
        });
        return;
      }
      
      // Gửi tin nhắn qua WebSocket
      client.current.publish({
        destination: '/app/chat/send',
        body: JSON.stringify(request),
      });


      setNewMessage("");
    
    } catch (error) {
      console.error("Conservation send message error:", error.message);
    
      alert("Gửi tin nhắn thất bại: " + error.message);
    }
  };

  // Hàm gửi hình ảnh
  const handleSendImage = (file) => {
    const newMsg = {
      id: Date.now(),
      type: "image",
      content: URL.createObjectURL(file),
      sender: "me",
      timestamp: new Date(),
      fileName: file.name,
    };
    setLocalMessages((prev) => [...prev, newMsg]);
    // Gọi API gửi hình ảnh tại đây (chưa triển khai)
  };

  // Hàm gửi tệp đính kèm
  const handleSendFile = (file) => {
    const newMsg = {
      id: Date.now(),
      type: "file",
      content: URL.createObjectURL(file),
      sender: "me",
      timestamp: new Date(),
      fileName: file.name,
    };
    setLocalMessages((prev) => [...prev, newMsg]);
    // Gọi API gửi file tại đây (chưa triển khai)
  };



  return (
    <div
      className="card shadow-sm h-100"
      style={{
        width: "100%",
        transition: "width 0.3s ease-in-out",
        height: "100vh",
      }}
    >
      {/* Header */}
      <div className="card-header d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <img
            src="../../../../public/images/avatar/avtdefault.jpg"
            alt="avatar"
            width={50}
            height={50}
            className="rounded-circle me-3"
          />
          <div className="flex-grow-1">
            <h6 className="mb-0">{!selectedConversation.is_group ? selectedConversation.members.find((member) => member.id !== currentUser.id).display_name : selectedConversation.name}</h6>
            <small className="text-muted">Người lạ · Không có nhóm chung</small>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm">
            <i className="bi bi-search"></i>
          </button>
          <button
            className="btn btn-sm"
            onClick={showDetail ? onHideDetail : onShowDetail}
          >
            <i
              className={`bi ${
                showDetail ? "bi bi-arrow-bar-right" : "bi bi-arrow-bar-left"
              } me-2`}
            ></i>
          </button>
        </div>
      </div>

      {/* Notification */}
      <div className="card-body d-flex align-items-center justify-content-between">
        <div>
          <i className="bi bi-person-plus-fill mx-2"></i>
          <span>Gửi yêu cầu kết bạn tới người này</span>
        </div>
        <button className="btn btn-outline-secondary btn-sm">
          Gửi kết bạn
        </button>
      </div>

      {/* Chat Messages */}
      <div
        className="card-body bg-light"
        style={{
          height: "calc(100vh - 230px)",
          overflowY: "auto",
          padding: "10px",
        }}
      >
        {isLoadingAllMessages ? (
          <p className="text-muted text-center">Đang tải tin nhắn...</p>
        ) : localMessages.length === 0 ? (
          <p className="text-muted text-center">Chưa có tin nhắn...</p>
        ) : (
          localMessages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-2 d-flex ${
                msg.sender === "me" || msg.senderId === currentUser.id
                  ? "justify-content-end"
                  : "justify-content-start"
              }`}
            >
              <div
                className={`p-2 rounded bg-text shadow-sm ${
                  msg.sender === "me" || msg.senderId === currentUser.id
                    ? "text-black"
                    : "bg-light border"
                }`}
                style={{ maxWidth: "70%" }}
              >
                {msg.type === "image" ? (
                  <button
                    className="btn p-0 border-0 bg-transparent"
                    onClick={() => window.open(msg.content, "_blank")}
                  >
                    <img
                      src={msg.content}
                      alt="Hình ảnh"
                      className="img-fluid rounded"
                      style={{
                        maxWidth: "300px",
                        maxHeight: "300px",
                        objectFit: "contain",
                      }}
                    />
                  </button>
                ) : msg.type === "file" ? (
                  <a
                    href={msg.content}
                    download={msg.fileName}
                    className="text-decoration-none text-black"
                  >
                    📎 {msg.fileName}
                  </a>
                ) : (
                  <span>{msg.content || msg.text}</span>
                )}
                <div>
                  <small className="text-muted d-block">
                    {formatTime(msg.created_at || msg.timestamp)}
                  </small>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} /> {/* Để tự động cuộn xuống cuối */}
      </div>

      {/* Input Section */}
      <div className="card-footer">
        {/* Icons Above Input */}
        <div className="d-flex align-items-center gap-2 mb-2">
          <button className="btn btn-light">
            <i className="bi bi-emoji-smile"></i>
          </button>
          <label className="btn btn-light mb-0" htmlFor="image-upload">
            <i className="bi bi-image"></i>
          </label>
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) handleSendImage(file);
            }}
          />
          <label className="btn btn-light mb-0" htmlFor="file-upload">
            <i className="bi bi-paperclip"></i>
          </label>
          <input
            type="file"
            id="file-upload"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) handleSendFile(file);
            }}
          />
          <button className="btn btn-light">
            <i className="bi bi-hash"></i>
          </button>
          <button
            className="btn btn-light"
            onClick={() => alert("Tính năng ghi âm đang được phát triển...")}
          >
            <i className="bi bi-mic"></i>
          </button>
          <button className="btn btn-light">
            <i className="bi bi-lightning"></i>
          </button>
          <button className="btn btn-light">
            <i className="bi bi-three-dots"></i>
          </button>
        </div>

        {/* Input + Gửi */}
        <div className="d-flex align-items-center gap-2">
          <input
            type="text"
            className="form-control"
            placeholder="Nhập tin nhắn..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendMessage();
            }}
          />
          <button
            className="btn btn-light d-flex align-items-center"
            onClick={handleSendMessage}
          >
            <i
              className={`bi ${
                newMessage.trim()
                  ? "bi-send-fill text-primary"
                  : "bi-emoji-smile"
              }`}
            ></i>
          </button>
          <button className="btn btn-light d-flex align-items-center">
            <i className="bi bi-hand-thumbs-up"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [showDetail, setShowDetail] = useState(false);
  const [conversationWidth, setConversationWidth] = useState("100%");

  const handleShowDetail = () => {
    setShowDetail(true);
    setConversationWidth("70%");
  };

  const handleHideDetail = () => {
    setShowDetail(false);
    setConversationWidth("100%");
  };

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      <div
        style={{
          width: conversationWidth,
          transition: "width 0.3s",
          height: "100vh",
        }}
      >
        <Conservation
          onShowDetail={handleShowDetail}
          onHideDetail={handleHideDetail}
          showDetail={showDetail}
        />
      </div>
      {showDetail && (
        <div
          style={{
            width: "30%",
            marginLeft: "10px",
            height: "100vh",
          }}
        >
          <ConversationDetail />
        </div>
      )}
    </div>
  );
};

export default App;
