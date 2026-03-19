import React from "react";
import styled from "styled-components";

function ImageUploadControl({
  inputId,
  accept = "image/*",
  onChange,
  onRemove,
  uploading = false,
  hasValue = false,
}) {
  return (
    <Wrap>
      <HiddenInput id={inputId} type="file" accept={accept} onChange={onChange} disabled={uploading} />
      <Buttons>
        <UploadLabel htmlFor={inputId}>
          {uploading ? "Загружаю..." : hasValue ? "Заменить" : "Загрузить"}
        </UploadLabel>
        {hasValue && (
          <RemoveButton type="button" onClick={onRemove} disabled={uploading}>
            Удалить
          </RemoveButton>
        )}
      </Buttons>
    </Wrap>
  );
}

export default ImageUploadControl;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HiddenInput = styled.input`
  display: none;
`;

const Buttons = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const UploadLabel = styled.label`
  border-radius: 14px;
  padding: 12px 16px;
  font-weight: 800;
  background: #eef5fb;
  color: #23598d;
  cursor: pointer;
`;

const RemoveButton = styled.button`
  border: none;
  border-radius: 14px;
  padding: 12px 16px;
  font: inherit;
  font-weight: 800;
  background: #fff0f0;
  color: #c44d4d;
  cursor: pointer;
`;
