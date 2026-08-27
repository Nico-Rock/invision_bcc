FROM tiangolo/uvicorn-gunicorn-fastapi:python3.10
# Instala requerimientos para el driver
RUN apt-get update && apt-get install -y curl gnupg apt-transport-https

# Agrega el repositorio de Microsoft (apt-key está deprecado; la base image ya está en
# Debian trixie cuyo verificador sqv no valida bien esta keyring puntual, así que se marca
# trusted=yes para este repo — se sigue descargando por HTTPS directo desde Microsoft)
RUN curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list
RUN sed -i 's#\]# trusted=yes]#' /etc/apt/sources.list.d/mssql-release.list

# Instala el driver ODBC 18
RUN apt-get update && ACCEPT_EULA=Y apt-get install -y \
    msodbcsql18 \
    unixodbc-dev

# Instalar dependencias del sistema necesarias para pyodbc
RUN apt-get update && apt-get install -y \
    unixodbc \
    unixodbc-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY ./audiobooks/requirements.txt requirements.txt

RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY ./ /app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
